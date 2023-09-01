//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {IWeth} from "../../interfaces/IWeth.sol";
import {IWsteth} from "../../interfaces/IWsteth.sol";
import {WstethAdapter} from "../../adapters/WstethAdapter.sol";
import {Teller} from "../../Teller.sol";
import {Handler} from "../../Handler.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../../libs/Types.sol";
import "../../libs/AssetUtils.sol";
import "../utils/NocturneUtils.sol";
import "../interfaces/IBalancer.sol";

contract WstethTest is Test {
    IWeth public constant weth =
        IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IWsteth public constant wsteth =
        IWsteth(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);
    address public constant balancer =
        address(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    address public constant DEPOSIT_SOURCE = address(0x111);
    address public constant ALICE = address(0x222);
    address public constant BUNDLER = address(0x333);

    Teller teller;
    Handler handler;
    WstethAdapter wstethAdapter;

    function setUp() public {
        wstethAdapter = new WstethAdapter(address(weth), address(wsteth));
        teller = new Teller();
        handler = new Handler();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        teller.initialize(
            "NocturneTeller",
            "v1",
            address(handler),
            address(joinSplitVerifier)
        );
        handler.initialize(address(subtreeUpdateVerifier), address(0x111));
        handler.setTeller(address(teller));

        teller.setDepositSourcePermission(DEPOSIT_SOURCE, true);
        handler.setSubtreeBatchFillerPermission(address(this), true);

        // Whitelist weth, wsteth, and balancer
        handler.setContractPermission(address(weth), true);
        handler.setContractPermission(address(wsteth), true);
        handler.setContractPermission(address(wstethAdapter), true);
        handler.setContractPermission(address(balancer), true);

        handler.setContractMethodPermission(
            address(weth),
            weth.approve.selector,
            true
        );
        handler.setContractMethodPermission(
            address(wstethAdapter),
            wstethAdapter.convert.selector,
            true
        );

        // Prefill tokens
        deal(address(weth), address(handler), 1);
        deal(address(wsteth), address(handler), 1);
    }

    function reserveAndDepositWeth(uint256 amount) internal {
        deal(address(weth), DEPOSIT_SOURCE, amount);

        CompressedStealthAddress memory addr = NocturneUtils
            .defaultStealthAddress();
        Deposit memory deposit = NocturneUtils.formatDeposit(
            ALICE,
            address(weth),
            amount,
            ERC20_ID,
            addr
        );

        vm.prank(DEPOSIT_SOURCE);
        weth.approve(address(teller), amount);

        vm.prank(DEPOSIT_SOURCE);
        teller.depositFunds(deposit);
    }

    function testSingleDepositForWsteth(uint256 amount) public {
        amount = bound(amount, 1000, 10000 ether);
        reserveAndDepositWeth(amount);

        uint256 wethInAmount = amount;
        uint256 wstethOutAmount = wsteth.getWstETHByStETH(amount);

        // Format operation to unwrap weth, unwrap to eth, then send to wsteth
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(wsteth),
                ERC20_ID
            ),
            minRefundValue: wstethOutAmount
        });

        Action[] memory actions = new Action[](2);
        actions[0] = Action({
            contractAddress: address(weth),
            encodedFunction: abi.encodeWithSelector(
                weth.approve.selector,
                address(wstethAdapter),
                wethInAmount
            )
        });
        actions[1] = Action({
            contractAddress: address(wstethAdapter),
            encodedFunction: abi.encodeWithSelector(
                wstethAdapter.convert.selector,
                wethInAmount
            )
        });

        // Create operation to convert weth to wsteth
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(weth)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(weth),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            wethInAmount,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: 200_000,
                gasPrice: 0,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check pre op balances
        assertEq(weth.balanceOf(address(teller)), amount);
        assertEq(wsteth.balanceOf(address(teller)), 0);

        // Execute operation
        vm.prank(BUNDLER);
        teller.processBundle(bundle);

        // Check post op balances
        assertEq(weth.balanceOf(address(teller)), 0);
        assertEq(wsteth.balanceOf(address(teller)), wstethOutAmount);
    }
}
