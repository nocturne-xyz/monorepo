// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {DepositManagerHandler} from "./actors/DepositManagerHandler.sol";
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

contract DepositManagerInvariants is Test {
    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";
    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER_ADDRESS = vm.addr(SCREENER_PRIVKEY);

    DepositManagerHandler public depositManagerHandler;

    Wallet public wallet;
    Handler public handler;
    TestDepositManager public depositManager;
    WETH9 public weth;

    SimpleERC20Token public erc20;
    SimpleERC721Token public erc721;
    SimpleERC1155Token public erc1155;

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

        erc20 = new SimpleERC20Token();
        erc721 = new SimpleERC721Token();
        erc1155 = new SimpleERC1155Token();

        depositManagerHandler = new DepositManagerHandler(
            depositManager,
            erc20,
            erc721,
            erc1155
        );
        erc20.reserveTokens(address(depositManagerHandler), type(uint256).max);

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

    function invariant_callSummary() public view {
        depositManagerHandler.callSummary();
    }

    // _______________ETH_______________

    function invariant_outNeverExceedsInETH() external {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumETH(),
            depositManagerHandler.ghost_retrieveDepositSumETH() +
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutETH() external {
        assertEq(
            weth.balanceOf(address(depositManagerHandler.depositManager())),
            depositManagerHandler.ghost_instantiateDepositSumETH() -
                depositManagerHandler.ghost_retrieveDepositSumETH() -
                depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_allActorsBalanceSumETHEqualsRetrieveDepositSumETH()
        external
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += weth.balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumETH());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumETH() external {
        assertEq(
            weth.balanceOf(address(wallet)),
            depositManagerHandler.ghost_completeDepositSumETH()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedETH() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                weth.balanceOf(allActors[i]),
                depositManagerHandler.ghost_retrieveDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiatedETH() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                weth.balanceOf(allActors[i]),
                depositManagerHandler.ghost_instantiateDepositSumETHFor(
                    allActors[i]
                )
            );
        }
    }

    // _______________ERC20_______________

    function invariant_outNeverExceedsInErc20() external {
        assertGe(
            depositManagerHandler.ghost_instantiateDepositSumErc20(),
            depositManagerHandler.ghost_retrieveDepositSumErc20() +
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_depositManagerBalanceEqualsInMinusOutErc20() external {
        assertEq(
            depositManagerHandler.erc20().balanceOf(
                address(depositManagerHandler.depositManager())
            ),
            depositManagerHandler.ghost_instantiateDepositSumErc20() -
                depositManagerHandler.ghost_retrieveDepositSumErc20() -
                depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_allActorsBalanceSumErc20EqualsRetrieveDepositSumErc20()
        external
    {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        uint256 sum = 0;
        for (uint256 i = 0; i < allActors.length; i++) {
            sum += depositManagerHandler.erc20().balanceOf(allActors[i]);
        }

        assertEq(sum, depositManagerHandler.ghost_retrieveDepositSumErc20());
    }

    function invariant_walletBalanceEqualsCompletedDepositSumErc20() external {
        assertEq(
            depositManagerHandler.erc20().balanceOf(address(wallet)),
            depositManagerHandler.ghost_completeDepositSumErc20()
        );
    }

    function invariant_actorBalanceAlwaysEqualsRetrievedErc20() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertEq(
                depositManagerHandler.erc20().balanceOf(allActors[i]),
                depositManagerHandler.ghost_retrieveDepositSumErc20For(
                    allActors[i]
                )
            );
        }
    }

    function invariant_actorBalanceNeverExceedsInstantiatedErc20() external {
        address[] memory allActors = depositManagerHandler.ghost_AllActors();

        for (uint256 i = 0; i < allActors.length; i++) {
            assertLe(
                depositManagerHandler.erc20().balanceOf(allActors[i]),
                depositManagerHandler.ghost_instantiateDepositSumErc20For(
                    allActors[i]
                )
            );
        }
    }
}
