// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {TestBalanceManager} from "../../harnesses/TestBalanceManager.sol";
import {OperationGenerator, GenerateOperationArgs, GeneratedOperationMetadata} from "../helpers/OperationGenerator.sol";
import {TokenIdSet, LibTokenIdSet} from "../helpers/TokenIdSet.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import {OperationUtils} from "../../../libs/OperationUtils.sol";
import "../helpers/WorkaroundOpUtils.sol";
import "../../utils/NocturneUtils.sol";
import "../../../libs/Types.sol";

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver, IERC165} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract BalanceManagerHandler is
    OperationGenerator,
    IERC721Receiver,
    IERC1155Receiver
{
    using LibTokenIdSet for TokenIdSet;

    uint256 constant OPERATION_STAGE_SLOT = 174;
    uint256 constant ENTERED_PREFILL = 2;
    address constant BUNDLER_ADDRESS = address(0x1);

    // ______PUBLIC______
    Wallet public wallet;
    TestBalanceManager public balanceManager;
    TokenSwapper public swapper;

    SimpleERC20Token public depositErc20;
    SimpleERC721Token public depositErc721;
    SimpleERC1155Token public depositErc1155;

    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public lastCall;
    uint256 public ghost_bundlerComp;
    mapping(bytes32 => uint256) public prefilledAssetBalances;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;

    TokenIdSet _depositErc1155IdSet;

    OperationWithoutStructArrays internal _currentOpWithoutStructArrays;
    OperationStructArrays internal _currentOpStructArrays;
    OperationResult internal _currentOpResult;

    constructor(
        Wallet _wallet,
        TestBalanceManager _balanceManager,
        TokenSwapper _swapper,
        SimpleERC20Token _depositErc20,
        SimpleERC721Token _depositErc721,
        SimpleERC1155Token _depositErc1155,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155
    ) {
        wallet = _wallet;
        balanceManager = _balanceManager;
        swapper = _swapper;
        depositErc20 = _depositErc20;
        depositErc721 = _depositErc721;
        depositErc1155 = _depositErc1155;
        swapErc20 = _swapErc20;
        swapErc721 = _swapErc721;
        swapErc1155 = _swapErc1155;
    }

    modifier trackCall(bytes32 key) {
        lastCall = key;
        _;
        _calls[lastCall]++;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("BalanceManagerHandler call summary:");
        console.log("-------------------");
        console.log("addToAssetPrefill", _calls["addToAssetPrefill"]);
        console.log(
            "processJoinSplitsReservingFee",
            _calls["processJoinSplitsReservingFee"]
        );
        console.log(
            "gatherReservedGasAndPayBundler",
            _calls["gatherReservedGasAndPayBundler"]
        );
        console.log("handleAllRefunds", _calls["handleAllRefunds"]);
        console.log("no-op", _calls["no-op"]);
    }

    function call(uint256 seed, OperationResult memory opResult) public {
        // Ensure cycle of processJoinSplitsReservingFee -> gatherReservedGasAndPayBundler ->
        // handleAllRefunds
        if (lastCall == bytes32("processJoinSplitsReservingFee")) {
            _gatherReservedGasAndPayBundler(opResult);
        } else if (lastCall == bytes32("gatherReservedGasAndPayBundler")) {
            _handleAllRefunds();
        } else {
            uint256 prefill = bound(seed, 0, 1);
            if (prefill == 1) {
                _addToAssetPrefill(seed);
            } else {
                _processJoinSplitsReservingFee(seed);
            }
        }
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            (interfaceId == type(IERC165).interfaceId) ||
            (interfaceId == type(IERC721Receiver).interfaceId) ||
            (interfaceId == type(IERC1155Receiver).interfaceId);
    }

    function _addToAssetPrefill(
        uint256 seed
    ) internal trackCall("addToAssetPrefill") {
        uint256 assetType = bound(seed, 0, 1);

        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_SLOT),
            bytes32(ENTERED_PREFILL)
        );

        EncodedAsset memory encodedAsset;
        uint256 value;
        if (assetType == 0) {
            value = bound(seed, 0, 1_000_000); // TODO: make these bounds better
            depositErc20.reserveTokens(address(this), value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositErc20),
                ERC20_ID
            );

            AssetUtils.approveAsset(
                encodedAsset,
                address(balanceManager),
                value
            );
        } else {
            value = bound(seed, 0, 1_000_000);
            depositErc1155.reserveTokens(address(this), seed, value);

            encodedAsset = AssetUtils.encodeAsset(
                AssetType.ERC1155,
                address(depositErc1155),
                seed
            );

            AssetUtils.approveAsset(
                encodedAsset,
                address(balanceManager),
                value
            );

            _depositErc1155IdSet.add(seed);
        }

        balanceManager.addToAssetPrefill(encodedAsset, value);

        bytes32 assetHash = AssetUtils.hashEncodedAsset(encodedAsset);
        prefilledAssetBalances[assetHash] += value;
    }

    function _processJoinSplitsReservingFee(
        uint256 seed
    ) internal trackCall("processJoinSplitsReservingFee") {
        // Generate random op and verification gas
        (Operation memory op, ) = _generateRandomOperation(
            GenerateOperationArgs({
                seed: seed,
                wallet: wallet,
                handler: address(balanceManager),
                root: balanceManager.root(),
                statefulNfGeneration: true,
                swapper: swapper,
                joinSplitToken: depositErc20,
                gasToken: depositErc20,
                swapErc20: swapErc20,
                swapErc721: swapErc721,
                swapErc1155: swapErc1155
            })
        );

        // Make call
        balanceManager.processJoinSplitsReservingFee(
            op,
            PER_JOINSPLIT_VERIFY_GAS
        );

        // Save operation result details
        _currentOpWithoutStructArrays = OperationWithoutStructArrays({
            refundAddr: op.refundAddr,
            encodedGasAsset: op.encodedGasAsset,
            executionGasLimit: op.executionGasLimit,
            maxNumRefunds: op.maxNumRefunds,
            gasPrice: op.gasPrice,
            chainId: op.chainId,
            deadline: op.deadline,
            atomicActions: op.atomicActions
        });

        for (uint256 i = 0; i < op.joinSplits.length; i++) {
            _currentOpStructArrays.joinSplits.push(op.joinSplits[i]);
        }
        for (uint256 i = 0; i < op.encodedRefundAssets.length; i++) {
            _currentOpStructArrays.encodedRefundAssets.push(
                op.encodedRefundAssets[i]
            );
        }
        for (uint256 i = 0; i < op.actions.length; i++) {
            _currentOpStructArrays.actions.push(op.actions[i]);
        }
    }

    function _gatherReservedGasAndPayBundler(
        OperationResult memory opResult
    ) internal trackCall("gatherReservedGasAndPayBundler") {
        Operation memory op = WorkaroundOpUtils.joinOperation(
            _currentOpWithoutStructArrays,
            _currentOpStructArrays
        );

        // Fill op result with dummy vals
        opResult.verificationGas = ((PER_JOINSPLIT_VERIFY_GAS +
            GAS_PER_JOINSPLIT_HANDLE) * op.joinSplits.length);
        opResult.executionGas = op.executionGasLimit;
        opResult.numRefunds = op.maxNumRefunds;

        balanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            PER_JOINSPLIT_VERIFY_GAS,
            BUNDLER_ADDRESS
        );

        _currentOpResult = opResult;

        uint256 expectedBunderComp = balanceManager
            .calculateBundlerGasAssetPayout(op, opResult);
        ghost_bundlerComp += expectedBunderComp;
    }

    function _handleAllRefunds() internal trackCall("handleAllRefunds") {
        Operation memory op = WorkaroundOpUtils.joinOperation(
            _currentOpWithoutStructArrays,
            _currentOpStructArrays
        );

        balanceManager.handleAllRefunds(op);
    }

    function ghost_prefilledErc1155Ids()
        public
        view
        returns (uint256[] memory)
    {
        return _depositErc1155IdSet.getIds();
    }

    function ghost_lastProcessedOperation()
        public
        view
        returns (Operation memory)
    {
        return
            WorkaroundOpUtils.joinOperation(
                _currentOpWithoutStructArrays,
                _currentOpStructArrays
            );
    }

    function ghost_lastOperationResult()
        public
        view
        returns (OperationResult memory)
    {
        return
            OperationResult({
                opProcessed: _currentOpResult.opProcessed,
                assetsUnwrapped: _currentOpResult.assetsUnwrapped,
                failureReason: _currentOpResult.failureReason,
                callSuccesses: _currentOpResult.callSuccesses,
                callResults: _currentOpResult.callResults,
                verificationGas: _currentOpResult.verificationGas,
                executionGas: _currentOpResult.executionGas,
                numRefunds: _currentOpResult.numRefunds
            });
    }
}
