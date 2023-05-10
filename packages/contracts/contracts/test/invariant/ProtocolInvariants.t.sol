// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {InvariantsBase} from "./InvariantsBase.sol";
import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";
import {TellerHandler} from "./actors/TellerHandler.sol";
import {HandlerHandler} from "./actors/HandlerHandler.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../utils/NocturneUtils.sol";
import {TestDepositManager} from "../harnesses/TestDepositManager.sol";
import {Teller} from "../../Teller.sol";
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
        teller = new Teller();
        handler = new Handler();
        depositManager = new TestDepositManager();

        weth = new WETH9();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        handler.initialize(address(teller), address(subtreeUpdateVerifier));
        teller.initialize(address(handler), address(joinSplitVerifier));

        teller.setDepositSourcePermission(address(depositManager), true);
        handler.setSubtreeBatchFillerPermission(address(this), true);

        depositManager.initialize(
            CONTRACT_NAME,
            CONTRACT_VERSION,
            address(teller),
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

        swapper = new TokenSwapper();
        swapErc20 = new SimpleERC20Token();
        swapErc721 = new SimpleERC721Token();
        swapErc1155 = new SimpleERC1155Token();

        tellerHandler = new TellerHandler(
            teller,
            handler,
            swapper,
            depositErc20,
            depositErc20,
            swapErc20,
            swapErc721,
            swapErc1155
        );

        depositManager.setErc20Cap(
            address(weth),
            type(uint32).max,
            type(uint32).max,
            weth.decimals()
        );

        depositManager.setErc20Cap(
            address(depositErc20),
            type(uint32).max,
            type(uint32).max,
            depositErc20.decimals()
        );

        // TODO: allow other tokens once we enable transacting with them
        handler.setSupportedContractAllowlistPermission(
            address(depositErc20),
            true
        );
        handler.setSupportedContractAllowlistPermission(address(swapper), true);
        handler.setSupportedContractAllowlistPermission(
            address(swapErc20),
            true
        );
        handler.setSupportedContractAllowlistPermission(
            address(swapErc721),
            true
        );
        handler.setSupportedContractAllowlistPermission(
            address(swapErc1155),
            true
        );

        handler.setSubtreeBatchFillerPermission(
            address(SUBTREE_BATCH_FILLER_ADDRESS),
            true
        );

        handlerHandler = new HandlerHandler(
            handler,
            SUBTREE_BATCH_FILLER_ADDRESS,
            depositErc20,
            depositErc1155
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

        bytes4[] memory tellerHandlerSelectors = new bytes4[](1);
        tellerHandlerSelectors[0] = tellerHandler.processBundle.selector;

        bytes4[] memory handlerHandlerSelectors = new bytes4[](2);
        handlerHandlerSelectors[0] = handlerHandler.addToAssetPrefill.selector;
        handlerHandlerSelectors[1] = handlerHandler.fillBatchWithZeros.selector;

        targetContract(address(depositManagerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(depositManagerHandler),
                selectors: depositManagerHandlerSelectors
            })
        );

        targetContract(address(tellerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(tellerHandler),
                selectors: tellerHandlerSelectors
            })
        );

        targetContract(address(handlerHandler));
        targetSelector(
            FuzzSelector({
                addr: address(handlerHandler),
                selectors: handlerHandlerSelectors
            })
        );

        excludeSender(address(0x0));
        excludeSender(tellerHandler.BUNDLER_ADDRESS());
        excludeSender(tellerHandler.TRANSFER_RECIPIENT_ADDRESS());
        excludeSender(SCREENER_ADDRESS);
        excludeSender(address(depositManagerHandler));
        excludeSender(address(tellerHandler));
        excludeSender(address(swapper));
        excludeSender(address(teller));
        excludeSender(address(handler));
        excludeSender(address(depositManager));
        excludeSender(address(weth));

        teller.transferOwnership(OWNER);
        handler.transferOwnership(OWNER);
    }

    function invariant_callSummary() external {
        print_callSummary();
    }

    /*****************************
     * Protocol-Wide
     *****************************/
    function invariant_protocol_tellerBalanceEqualsCompletedDepositSumMinusTransferedOutPlusBundlerPayoutErc20()
        external
    {
        assert_protocol_tellerBalanceEqualsCompletedDepositSumMinusTransferedOutPlusBundlerPayoutErc20();
    }

    function invariant_protocol_handlerAlwaysEndsWithPrefillBalances()
        external
    {
        assert_protocol_handlerAlwaysEndsWithPrefillBalances();
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

    function invariant_deposit_screenerBalanceInBounds() external {
        assert_deposit_screenerBalanceInBounds();
    }

    function invariant_deposit_actorBalancesInBounds() external {
        assert_deposit_actorBalancesInBounds();
    }

    /*****************************
     * Operations
     *****************************/
    function invariant_operation_totalSwapErc20ReceivedMatchesTellerBalance()
        external
    {
        assert_operation_totalSwapErc20ReceivedMatchesTellerBalance();
    }

    // function invariant_operation_tellerOwnsAllSwapErc721s() external {
    //     assert_operation_tellerOwnsAllSwapErc721s();
    // }

    function invariant_operation_totalSwapErc1155ReceivedMatchesTellerBalance()
        external
    {
        assert_operation_totalSwapErc1155ReceivedMatchesTellerBalance();
    }

    function invariant_operation_bundlerBalanceMatchesTracked() external {
        assert_operation_bundlerBalanceMatchesTracked();
    }
}
