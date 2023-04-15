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
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {OperationGenerator, GenerateOperationArgs, GeneratedOperationMetadata} from "../helpers/OperationGenerator.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract WalletHandler is OperationGenerator {
    uint256 constant BUNDLER_PRIVKEY = 2;
    address BUNDLER_ADDRESS = vm.addr(BUNDLER_PRIVKEY);

    // ______PUBLIC______
    Wallet public wallet;
    Handler public handler;
    TokenSwapper public swapper;

    SimpleERC20Token public joinSplitToken;
    SimpleERC20Token public gasToken;

    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    bytes32 public lastCall;

    // ______INTERNAL______

    mapping(bytes32 => uint256) internal _calls;
    mapping(string => uint256) internal _reverts;
    uint256 internal _numSuccessfulActions;
    string[] internal _failureReasons;

    TransferRequest[] internal _successfulTransfers;
    SwapRequest[] internal _successfulSwaps;

    constructor(
        Wallet _wallet,
        Handler _handler,
        TokenSwapper _swapper,
        SimpleERC20Token _joinSplitToken,
        SimpleERC20Token _gasToken,
        SimpleERC20Token _swapErc20,
        SimpleERC721Token _swapErc721,
        SimpleERC1155Token _swapErc1155
    ) {
        wallet = _wallet;
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
        console.log("WalletHandler call summary:");
        console.log("-------------------");
        console.log("Successful actions", _numSuccessfulActions);

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
                    wallet: wallet,
                    handler: handler,
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

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        // TODO: enable multiple ops in bundle
        OperationResult memory opResult = opResults[0];

        if (bytes(opResult.failureReason).length > 0) {
            _failureReasons.push(opResult.failureReason);
        }

        for (uint256 j = 0; j < opResult.callSuccesses.length; j++) {
            if (opResult.callSuccesses[j]) {
                if (meta.isTransfer[j]) {
                    _successfulTransfers.push(meta.transfers[j]);
                } else if (meta.isSwap[j]) {
                    _successfulSwaps.push(meta.swaps[j]);
                }
                _numSuccessfulActions += 1;
            }
        }
    }

    // ______VIEW______
    function ghost_totalTransferredOutOfWallet()
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
}
