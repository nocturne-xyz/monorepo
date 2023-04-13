// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import "../../utils/NocturneUtils.sol";
import "../../utils/ForgeUtils.sol";
import {TestWallet} from "../../harnesses/TestWallet.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {DepositSumSet, LibDepositSumSet} from "../helpers/DepositSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract WalletHandler is CommonBase, StdCheats, StdUtils {
    uint256 constant ERC20_ID = 0;

    uint256 constant BUNDLER_PRIVKEY = 2;
    address BUNDLER_ADDRESS = vm.addr(BUNDLER_PRIVKEY);

    // ______PUBLIC______
    TestWallet public wallet;

    SimpleERC20Token public joinSplitToken;
    SimpleERC20Token public gasToken;

    bytes32 public lastCall;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    mapping(string => uint256) internal _reverts;

    constructor(TestWallet _wallet) {
        wallet = _wallet;
    }

    // ______EXTERNAL______

    function callSummary() external view {
        console.log("WalletHandler call summary:");
        console.log("-------------------");
    }

    // function processBundle(uint256 seed) external view {
    //     uint256 numOps = bound(seed, 1, 10);
    // }

    // ______VIEW______

    // ______INTERNAL______
    function _generateRandomOperation(
        uint256 seed
    ) internal pure returns (Operation memory _op) {
        // FormatOperationArgs memory args;
        // args.joinSplitToken = joinSplitToken;
        // args.gasToken = gasToken;
        // uint256 totalJoinSplitUnwrapAmount = bound(
        //     seed,
        //     0,
        //     erc20.balanceOf(wallet)
        // );
    }
}
