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

        // TODO: allow other tokens once we enable transacting with them
        handler.setCallableContractAllowlistPermission(
            address(depositErc20),
            depositErc20.approve.selector,
            true
        );
        handler.setCallableContractAllowlistPermission(
            address(depositErc20),
            depositErc20.transfer.selector,
            true
        );

        handler.setCallableContractAllowlistPermission(
            address(swapper),
            swapper.swap.selector,
            true
        );

        bytes4[] memory depositManagerHandlerSelectors = new bytes4[](4);
        depositManagerHandlerSelectors[0] = depositManagerHandler
            .instantiateDepositETH
            .selector;
        depositManagerHandlerSelectors[1] = depositManagerHandler
            .instantiateDepositErc20
            .selector;
        depositManagerHandlerSelectors[2] = depositManagerHandler
            .retrieveDepositErc20
            .selector;
        depositManagerHandlerSelectors[3] = depositManagerHandler
            .completeDepositErc20
            .selector;

        bytes4[] memory walletHandlerSelectors = new bytes4[](1);
        walletHandlerSelectors[0] = walletHandler.processBundle.selector;

        targetContract(address(depositManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(depositManagerHandler),
                selectors: depositManagerHandlerSelectors
            })
        );

        targetContract(address(walletHandler));
        targetSelector(
            FuzzSelector({
                addr: address(walletHandler),
                selectors: walletHandlerSelectors
            })
        );

        excludeSender(address(depositManagerHandler));
        excludeSender(address(walletHandler));
        excludeSender(address(wallet));
        excludeSender(address(handler));
        excludeSender(address(depositManager));
        excludeSender(address(weth));
    }

    function invariant_callSummary() external {
        print_callSummary();
    }

    /*****************************
     * Protocol-Wide
     *****************************/
    function invariant_protocol_walletBalanceEqualsCompletedDepositSumETH()
        external
    {
        assert_protocol_walletBalanceEqualsCompletedDepositSumETH();
    }

    function invariant_protocol_walletBalanceEqualsCompletedDepositSumMinusTransferedOutErc20()
        external
    {
        assert_protocol_walletBalanceEqualsCompletedDepositSumMinusTransferedOutErc20();
    }

    /*****************************
     * Deposits ETH
     *****************************/
    function invariant_deposit_outNeverExceedsInETH() external {
        assert_deposit_outNeverExceedsInETH();
    }

    function invariant_deposit_depositManagerBalanceEqualsInMinusOutETH()
        external
    {
        assert_deposit_depositManagerBalanceEqualsInMinusOutETH();
    }

    function invariant_deposit_allActorsBalanceSumETHEqualsRetrieveDepositSumETH()
        external
    {
        assert_deposit_allActorsBalanceSumETHEqualsRetrieveDepositSumETH();
    }

    function invariant_deposit_actorBalanceAlwaysEqualsRetrievedETH() external {
        assert_deposit_actorBalanceAlwaysEqualsRetrievedETH();
    }

    function invariant_deposit_actorBalanceNeverExceedsInstantiatedETH()
        external
    {
        assert_deposit_actorBalanceNeverExceedsInstantiatedETH();
    }

    /*****************************
     * Deposits ERC20
     *****************************/
    function invariant_deposit_outNeverExceedsInErc20() external {
        assert_deposit_outNeverExceedsInErc20();
    }

    function invariant_deposit_depositManagerBalanceEqualsInMinusOutErc20()
        external
    {
        assert_deposit_depositManagerBalanceEqualsInMinusOutErc20();
    }

    function invariant_deposit_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20()
        external
    {
        assert_deposit_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20();
    }

    function invariant_deposit_actorBalanceAlwaysEqualsRetrievedErc20()
        external
    {
        assert_deposit_actorBalanceAlwaysEqualsRetrievedErc20();
    }

    function invariant_deposit_actorBalanceNeverExceedsInstantiatedErc20()
        external
    {
        assert_deposit_actorBalanceNeverExceedsInstantiatedErc20();
    }
}
