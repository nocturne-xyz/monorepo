// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import "../../utils/NocturneUtils.sol";
import "../../utils/ForgeUtils.sol";
import {Teller} from "../../../Teller.sol";
import {Handler} from "../../../Handler.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {OperationGenerator, GenerateOperationArgs, GeneratedOperationMetadata} from "../helpers/OperationGenerator.sol";
import {TokenIdSet, LibTokenIdSet} from "../helpers/TokenIdSet.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract TellerHandler is OperationGenerator {
    using LibTokenIdSet for TokenIdSet;

    uint256 constant BUNDLER_PRIVKEY = 2;
    address public BUNDLER_ADDRESS = vm.addr(BUNDLER_PRIVKEY);

    // ______PUBLIC______
    Teller public teller;
    Handler public handler;
    TokenSwapper public swapper;

    SimpleERC20Token public joinSplitToken;
    SimpleERC20Token public gasToken;

    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public lastCall;
    uint256 public ghost_totalBundlerPayout;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    uint256 internal _numSuccessfulActions;
    string[] internal _failureReasons;

    TransferRequest[] internal _successfulTransfers;
    SwapRequest[] internal _successfulSwaps;
    TokenIdSet internal _receivedErc721Ids;
    TokenIdSet internal _receivedErc1155Ids;

    constructor(
        Teller _teller,
        Handler _handler,
        TokenSwapper _swapper,
        SimpleERC20Token _joinSplitToken,
        SimpleERC20Token _gasToken,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155
    ) {
        teller = _teller;
        handler = _handler;
        swapper = _swapper;
        joinSplitToken = _joinSplitToken;
        gasToken = _gasToken;
        swapErc20 = _swapErc20;
        swapErc721 = _swapErc721;
        swapErc1155 = _swapErc1155;
    }

    // ______EXTERNAL______
    function callSummary() external view {
        console.log("-------------------");
        console.log("TellerHandler call summary:");
        console.log("-------------------");
        console.log("Successful actions", _numSuccessfulActions);
        console.log(
            "Bundler balance",
            joinSplitToken.balanceOf(BUNDLER_ADDRESS)
        );

        console.log("Failure reasons:");
        for (uint256 i = 0; i < _failureReasons.length; i++) {
            console.log(_failureReasons[i]);
        }

        console.log("Metadata:");
        for (uint256 i = 0; i < _successfulTransfers.length; i++) {
            console.log("Transfer amount", _successfulTransfers[i].amount);
        }
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            console.log("Swap in amount", _successfulSwaps[i].assetInAmount);
        }

        console.log(
            "Swapper joinsplit balance",
            joinSplitToken.balanceOf(address(swapper))
        );
    }

    function processBundle(uint256 seed) external {
        (
            Operation memory op,
            GeneratedOperationMetadata memory meta
        ) = _generateRandomOperation(
                GenerateOperationArgs({
                    seed: seed,
                    teller: teller,
                    handler: address(handler),
                    root: handler.root(),
                    statefulNfGeneration: false,
                    swapper: swapper,
                    joinSplitToken: joinSplitToken,
                    gasToken: gasToken,
                    swapErc20: swapErc20,
                    swapErc721: swapErc721,
                    swapErc1155: swapErc1155
                })
            );

        Bundle memory bundle;
        bundle.operations = new Operation[](1);
        bundle.operations[0] = op;

        vm.prank(BUNDLER_ADDRESS);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // TODO: enable multiple ops in bundle
        OperationResult memory opResult = opResults[0];

        if (opResult.assetsUnwrapped) {
            uint256 bundlerPayout = _calculateBundlerGasAssetPayout(
                op,
                opResult
            );
            ghost_totalBundlerPayout += bundlerPayout;
        }

        if (bytes(opResult.failureReason).length > 0) {
            _failureReasons.push(opResult.failureReason);
        }

        for (uint256 i = 0; i < opResult.callSuccesses.length; i++) {
            if (opResult.callSuccesses[i]) {
                if (meta.isTransfer[i]) {
                    _successfulTransfers.push(meta.transfers[i]);
                } else if (meta.isSwap[i]) {
                    _successfulSwaps.push(meta.swaps[i]);
                    _receivedErc721Ids.add(meta.swaps[i].erc721OutId);
                    _receivedErc1155Ids.add(meta.swaps[i].erc1155OutId);
                }
                _numSuccessfulActions += 1;
            }
        }
    }

    // ______VIEW______
    function ghost_totalTransferredOutOfTeller()
        external
        view
        returns (uint256)
    {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulTransfers.length; i++) {
            total += _successfulTransfers[i].amount;
        }
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            total += _successfulSwaps[i].assetInAmount;
        }
        return total;
    }

    function ghost_totalSwapErc20Received() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            total += _successfulSwaps[i].erc20OutAmount;
        }
        return total;
    }

    function ghost_totalSwapErc1155ReceivedForId(
        uint256 id
    ) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            if (_successfulSwaps[i].erc1155OutId == id) {
                total += _successfulSwaps[i].erc1155OutAmount;
            }
        }
        return total;
    }

    function ghost_swapErc721IdsReceived()
        external
        view
        returns (uint256[] memory)
    {
        return _receivedErc721Ids.getIds();
    }

    function ghost_swapErc1155IdsReceived()
        external
        view
        returns (uint256[] memory)
    {
        return _receivedErc1155Ids.getIds();
    }

    // ______UTILS______
    // Workaround for OperationUtils version only being for op calldata
    function _calculateBundlerGasAssetPayout(
        Operation memory op,
        OperationResult memory opResult
    ) internal pure returns (uint256) {
        uint256 handleJoinSplitGas = op.joinSplits.length *
            GAS_PER_JOINSPLIT_HANDLE;
        uint256 handleRefundGas = opResult.numRefunds * GAS_PER_REFUND_HANDLE;

        return
            op.gasPrice *
            (opResult.verificationGas +
                handleJoinSplitGas +
                opResult.executionGas +
                handleRefundGas);
    }
}
