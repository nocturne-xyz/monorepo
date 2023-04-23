// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console} from "forge-std/console.sol";

import {Wallet} from "../../Wallet.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {BalanceManagerHandler} from "./actors/BalanceManagerHandler.sol";
import {TestBalanceManager} from "../harnesses/TestBalanceManager.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {TreeUtils} from "../../libs/TreeUtils.sol";
import "../../libs/Types.sol";

contract BalanceManagerInvariants is Test {
    Wallet public wallet;

    BalanceManagerHandler public balanceManagerHandler;

    TokenSwapper public swapper;

    SimpleERC20Token public depositErc20;
    SimpleERC721Token public depositErc721;
    SimpleERC1155Token public depositErc1155;
    SimpleERC20Token public swapErc20;
    SimpleERC721Token public swapErc721;
    SimpleERC1155Token public swapErc1155;

    function setUp() public virtual {
        wallet = new Wallet();
        TestBalanceManager balanceManager = new TestBalanceManager();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager.initialize(
            address(wallet),
            address(subtreeUpdateVerifier)
        );
        wallet.initialize(address(balanceManager), address(joinSplitVerifier));

        // wallet.setDepositSourcePermission(address(depositManager), true);

        depositErc20 = new SimpleERC20Token();
        depositErc721 = new SimpleERC721Token();
        depositErc1155 = new SimpleERC1155Token();

        swapper = new TokenSwapper();
        swapErc20 = new SimpleERC20Token();
        swapErc721 = new SimpleERC721Token();
        swapErc1155 = new SimpleERC1155Token();

        balanceManagerHandler = new BalanceManagerHandler(
            wallet,
            balanceManager,
            swapper,
            depositErc20,
            depositErc721,
            depositErc1155,
            swapErc20,
            swapErc721,
            swapErc1155
        );

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = balanceManagerHandler.addToAssetPrefill.selector;
        selectors[1] = balanceManagerHandler
            .processJoinSplitsReservingFee
            .selector;
        // selectors[3] = balanceManagerHandler
        //     .gatherReservedGasAndPayBundler
        //     .selector;
        // selectors[4] = balanceManagerHandler.handleAllRefunds.selector;

        targetContract(address(balanceManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(balanceManagerHandler),
                selectors: selectors
            })
        );
    }

    function invariant_callSummary() public view {
        balanceManagerHandler.callSummary();
    }
}
