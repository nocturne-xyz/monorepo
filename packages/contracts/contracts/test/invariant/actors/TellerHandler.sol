// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import {TestBalanceManager} from "../../harnesses/TestBalanceManager.sol";
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

    // ______PUBLIC______
    Teller public teller;
    Handler public handler;
    TokenSwapper public swapper;

    address public bundlerAddress;

    SimpleERC20Token[] public joinSplitTokens;
    SimpleERC20Token public gasToken;

    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public lastCall;
    uint256[] public ghost_totalJoinSplitUnwrappedForToken;
    uint256 public ghost_totalBundlerPayout;
    uint256[] public ghost_numberOfTimesPrefillTakenForToken;
    uint256[] public ghost_numberOfTimesPrefillRefilledForToken;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    uint256 internal _numSuccessfulActions;
    string[] internal _failureReasons;
    TestBalanceManager internal _testBalanceManager;

    TransferRequest[] internal _successfulTransfers;
    SwapRequest[] internal _successfulSwaps;
    TokenIdSet internal _receivedErc721Ids;
    TokenIdSet internal _receivedErc1155Ids;

    constructor(
        Teller _teller,
        Handler _handler,
        TokenSwapper _swapper,
        SimpleERC20Token[] memory _joinSplitTokens,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155,
        address _bundlerAddress,
        address _transferRecipientAddress
    ) OperationGenerator(_transferRecipientAddress) {
        teller = _teller;
        handler = _handler;
        swapper = _swapper;
        joinSplitTokens = _joinSplitTokens;
        gasToken = _joinSplitTokens[0];
        swapErc20 = _swapErc20;
        swapErc721 = _swapErc721;
        swapErc1155 = _swapErc1155;
        bundlerAddress = _bundlerAddress;

        // dummy, only for pure fns that only work for calldata
        _testBalanceManager = new TestBalanceManager();
    }

    // ______EXTERNAL______
    function callSummary() external view {
        console.log("-------------------");
        console.log("TellerHandler call summary:");
        console.log("-------------------");
        console.log("Successful actions", _numSuccessfulActions);
        console.log(
            "Bundler gas token balance",
            gasToken.balanceOf(bundlerAddress)
        );

        for (uint256 i = 0; i < joinSplitTokens.length; i++) {
            console.log(
                "JoinSplit token",
                i,
                "balance",
                joinSplitTokens[i].balanceOf(address(handler))
            );
        }

        console.log("swap erc20 received:", ghost_totalSwapErc20Received());

        uint256[] memory swapErc721Ids = ghost_swapErc721IdsReceived();
        for (uint256 i = 0; i < swapErc721Ids.length; i++) {
            console.log("swap erc721 received id:", swapErc721Ids[i]);
        }

        uint256[] memory swapErc1155Ids = ghost_swapErc1155IdsReceived();
        for (uint256 i = 0; i < swapErc1155Ids.length; i++) {
            console.log("swap erc1155s received id:", swapErc1155Ids[i]);
        }

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
    }

    function processBundle(uint256 seed) external {
        // Always ensure prefills exist so we don't deal with that logic in invariants
        uint256 numJoinSplitTokens = joinSplitTokens.length;
        for (uint256 i = 0; i < numJoinSplitTokens; i++) {
            if (joinSplitTokens[i].balanceOf(address(handler)) == 0) {
                joinSplitTokens[i].reserveTokens(address(this), 1);
                joinSplitTokens[i].transfer(address(handler), 1);
            }
            if (swapErc20.balanceOf(address(handler)) == 0) {
                swapErc20.reserveTokens(address(this), 1);
                swapErc20.transfer(address(handler), 1);
            }
        }

        bool[] memory prefillExistsForToken = new bool[](numJoinSplitTokens);
        for (uint256 i = 0; i < numJoinSplitTokens; i++) {
            prefillExistsForToken[i] =
                joinSplitTokens[i].balanceOf(address(handler)) > 0;
        }

        (
            Operation memory op,
            GeneratedOperationMetadata memory meta
        ) = _generateRandomOperation(
                GenerateOperationArgs({
                    seed: seed,
                    teller: teller,
                    handler: address(handler),
                    root: handler.root(),
                    statefulNfGeneration: true,
                    exceedJoinSplitsMarginInTokens: 1,
                    swapper: swapper,
                    joinSplitTokens: joinSplitTokens,
                    gasToken: gasToken,
                    swapErc20: swapErc20,
                    swapErc721: swapErc721,
                    swapErc1155: swapErc1155
                })
            );

        Bundle memory bundle;
        bundle.operations = new Operation[](1);
        bundle.operations[0] = op;

        vm.prank(bundlerAddress);
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

        for (uint256 i = 0; i < joinSplitTokens.length; i++) {
            ghost_totalJoinSplitUnwrappedForToken[
                i
            ] = _totalJoinSplitTokenAmountInOp(op, joinSplitTokens[i]);
        }

        for (uint256 i = 0; i < joinSplitTokens.length; i++) {
            if (
                prefillExistsForToken[i] &&
                joinSplitTokens[i].balanceOf(address(handler)) == 0
            ) {
                ghost_numberOfTimesPrefillTakenForToken[i] += 1;
            } else if (
                !prefillExistsForToken[i] &&
                joinSplitTokens[i].balanceOf(address(handler)) > 0
            ) {
                ghost_numberOfTimesPrefillRefilledForToken[i] += 1;
            }
        }
    }

    // ______VIEW______
    function ghost_totalTransferredOutOfTellerForToken(
        uint256 i
    ) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulTransfers.length; i++) {
            if (
                address(_successfulTransfers[i].token) ==
                address(joinSplitTokens[i])
            ) {
                total += _successfulTransfers[i].amount;
            }
        }
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            (, address tokenAddr, ) = AssetUtils.decodeAsset(
                _successfulSwaps[i].encodedAssetIn
            );
            if (tokenAddr == address(joinSplitTokens[i])) {
                total += _successfulSwaps[i].assetInAmount;
            }
        }
        return total;
    }

    function ghost_totalSwapErc20Received() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            total += _successfulSwaps[i].erc20OutAmount;
        }
        return total;
    }

    function ghost_totalSwapErc1155ReceivedForId(
        uint256 id
    ) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _successfulSwaps.length; i++) {
            if (_successfulSwaps[i].erc1155OutId == id) {
                total += _successfulSwaps[i].erc1155OutAmount;
            }
        }
        return total;
    }

    function ghost_swapErc721IdsReceived()
        public
        view
        returns (uint256[] memory)
    {
        return _receivedErc721Ids.getIds();
    }

    function ghost_swapErc1155IdsReceived()
        public
        view
        returns (uint256[] memory)
    {
        return _receivedErc1155Ids.getIds();
    }

    // ______UTILS______
    // Workaround for OperationUtils version not including gasAssetRefundThreshold logic
    function _calculateBundlerGasAssetPayout(
        Operation memory op,
        OperationResult memory opResult
    ) internal view returns (uint256) {
        uint256 payout = _testBalanceManager.calculateBundlerGasAssetPayout(
            op,
            opResult
        );

        uint256 maxGasAssetCost = _testBalanceManager
            .calculateOpMaxGasAssetCost(
                op,
                opResult.verificationGas / op.joinSplits.length
            );
        if (maxGasAssetCost - payout < op.gasAssetRefundThreshold) {
            payout = maxGasAssetCost;
        }

        return payout;
    }

    function _totalJoinSplitTokenAmountInOp(
        Operation memory op,
        SimpleERC20Token joinSplitToken
    ) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < op.joinSplits.length; i++) {
            EncodedAsset memory encodedAsset = op.joinSplits[i].encodedAsset;
            (, address assetAddr, ) = AssetUtils.decodeAsset(encodedAsset);
            if (assetAddr == address(joinSplitToken)) {
                total += op.joinSplits[i].publicSpend;
            }
        }
        return total;
    }
}
