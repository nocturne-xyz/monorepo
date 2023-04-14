// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {InvariantsBase} from "./InvariantsBase.sol";
import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";
import {WalletHandler} from "./actors/WalletHandler.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../utils/NocturneUtils.sol";
import {TestDepositManager} from "../harnesses/TestDepositManager.sol";
import {Wallet} from "../../Wallet.sol";
import {Handler} from "../../Handler.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import {EventParsing} from "../utils/EventParsing.sol";
import {WETH9} from "../tokens/WETH9.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {Utils} from "../../libs/Utils.sol";
import "../../libs/Types.sol";

contract ProtocolInvariants is Test, InvariantsBase {
    function setUp() public virtual {
        wallet = new Wallet();
        handler = new Handler();
        depositManager = new TestDepositManager();

        weth = new WETH9();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        handler.initialize(address(wallet), address(subtreeUpdateVerifier));
        wallet.initialize(address(handler), address(joinSplitVerifier));

        wallet.setDepositSourcePermission(address(depositManager), true);
        handler.setSubtreeBatchFillerPermission(address(this), true);

        depositManager.initialize(
            CONTRACT_NAME,
            CONTRACT_VERSION,
            address(wallet),
            address(weth)
        );
        depositManager.setScreenerPermission(SCREENER_ADDRESS, true);

        depositErc20 = new SimpleERC20Token();
        depositErc721 = new SimpleERC721Token();
        depositErc1155 = new SimpleERC1155Token();

        depositManagerHandler = new DepositManagerHandler(
            depositManager,
            depositErc20,
            depositErc721,
            depositErc1155
        );
        depositErc20.reserveTokens(
            address(depositManagerHandler),
            type(uint256).max
        );

        swapper = new TokenSwapper();
        swapErc20 = new SimpleERC20Token();
        swapErc721 = new SimpleERC721Token();
        swapErc1155 = new SimpleERC1155Token();

        walletHandler = new WalletHandler(
            wallet,
            handler,
            swapper,
            depositErc20,
            depositErc20,
            swapErc20,
            swapErc721,
            swapErc1155
        );

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = depositManagerHandler.instantiateDepositETH.selector;
        selectors[1] = depositManagerHandler.instantiateDepositErc20.selector;
        selectors[2] = depositManagerHandler.retrieveDepositErc20.selector;
        selectors[3] = depositManagerHandler.completeDepositErc20.selector;

        targetContract(address(depositManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(depositManagerHandler),
                selectors: selectors
            })
        );

        excludeSender(address(depositManagerHandler));
        excludeSender(address(wallet));
        excludeSender(address(depositManager));
        excludeSender(address(weth));
    }

    function invariant_callSummary() external {
        print_callSummary();
    }

    function invariant_deposits() external {
        assert_deposit_outNeverExceedsInETH();
        assert_deposit_depositManagerBalanceEqualsInMinusOutETH();
        assert_deposit_allActorsBalanceSumETHEqualsRetrieveDepositSumETH();
        assert_deposit_walletBalanceEqualsCompletedDepositSumETH();
        assert_deposit_actorBalanceAlwaysEqualsRetrievedETH();
        assert_deposit_actorBalanceNeverExceedsInstantiatedETH();

        assert_deposit_outNeverExceedsInErc20();
        assert_deposit_depositManagerBalanceEqualsInMinusOutErc20();
        assert_deposit_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20();
        assert_deposit_walletBalanceEqualsCompletedDepositSumErc20();
        assert_deposit_actorBalanceAlwaysEqualsRetrievedErc20();
        assert_deposit_actorBalanceNeverExceedsInstantiatedErc20();
    }
}
