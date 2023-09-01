//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {IWeth} from "../../interfaces/IWeth.sol";
import {IWsteth} from "../../interfaces/IWsteth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    IBalancer public constant balancer =
        IBalancer(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    bytes32 public constant WSTETH_ETH_POOL_ID = bytes32(0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080);
    bytes32 public constant TRI_ETH_POOL_ID = bytes32(0x42ed016f826165c2e5976fe5bc3df540c5ad0af700000000000000000000058b);

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
            address(wsteth),
            wsteth.approve.selector,
            true
        );
        handler.setContractMethodPermission(
            address(wstethAdapter),
            wstethAdapter.convert.selector,
            true
        );
        handler.setContractMethodPermission(
            address(balancer),
            balancer.swap.selector,
            true
        );

        // Prefill tokens
        deal(address(weth), address(handler), 1);
        deal(address(wsteth), address(handler), 1);
    }

    function reserveAndDeposit(address token, uint256 amount) internal {
        deal(address(token), DEPOSIT_SOURCE, amount);

        CompressedStealthAddress memory addr = NocturneUtils
            .defaultStealthAddress();
        Deposit memory deposit = NocturneUtils.formatDeposit(
            ALICE,
            address(token),
            amount,
            ERC20_ID,
            addr
        );

        vm.prank(DEPOSIT_SOURCE);
        IERC20(token).approve(address(teller), amount);

        vm.prank(DEPOSIT_SOURCE);
        teller.depositFunds(deposit);
    }

    function testSingleDeposit(uint256 wethInAmount) public {
        wethInAmount = bound(wethInAmount, 1000, 10000 ether);
        reserveAndDeposit(address(weth), wethInAmount);

        uint256 wstethExpectedOutAmount = wsteth.getWstETHByStETH(wethInAmount);

        // Format operation to unwrap weth, unwrap to eth, then send to wsteth
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(wsteth),
                ERC20_ID
            ),
            minRefundValue: wstethExpectedOutAmount
        });

        // Format actions
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
        assertEq(weth.balanceOf(address(teller)), wethInAmount);
        assertEq(wsteth.balanceOf(address(teller)), 0);

        // Execute operation
        vm.prank(BUNDLER);
        teller.processBundle(bundle);

        // Check post op balances
        assertEq(weth.balanceOf(address(teller)), 0);
        assertEq(wsteth.balanceOf(address(teller)), wstethExpectedOutAmount);
    }

    function testDirectSwapWstethForWeth(uint256 wstethInAmount) public {
        // NOTE: hardcode upper bound based on Balancer weth/wsteth pool liquidity ~5000 wsteth
        wstethInAmount = bound(wstethInAmount, 10000, 2000 ether);
        reserveAndDeposit(address(wsteth), wstethInAmount);

        console.log("wstethInAmount", wstethInAmount);

        // Get expected weth out amount, 2% slippage tolerance
        uint256 wethExpectedOutAmount = (wsteth.getStETHByWstETH(wstethInAmount) * 90) / 100;

        console.log("wethExpectedOutAmount", wethExpectedOutAmount);

        // Format weth as refund asset
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(weth),
                ERC20_ID
            ),
            minRefundValue: wethExpectedOutAmount
        });

        // Format swap data
        SingleSwap memory swap = SingleSwap({
            poolId: WSTETH_ETH_POOL_ID,
            kind: SwapKind.GIVEN_IN,
            assetIn: IAsset(address(wsteth)),
            assetOut: IAsset(address(weth)),
            amount: wstethInAmount,
            userData: bytes("")
        });

        FundManagement memory fundManagement = FundManagement({
            sender: address(handler),
            recipient: payable(address(handler)),
            fromInternalBalance: false,
            toInternalBalance: false
        });

        // Format approve and swap call in actions
        Action[] memory actions = new Action[](2);
        actions[0] = Action({
            contractAddress: address(wsteth),
            encodedFunction: abi.encodeWithSelector(
                wsteth.approve.selector,
                address(balancer),
                wstethInAmount
            )
        });
        actions[1] = Action({
            contractAddress: address(balancer),
            encodedFunction: abi.encodeWithSelector(
                balancer.swap.selector,
                swap,
                fundManagement,
                wethExpectedOutAmount,
                block.timestamp + 3600
            )
        });

        // Create operation to convert weth to wsteth
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(wsteth)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(wsteth),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            wstethInAmount,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: 300_000,
                gasPrice: 0,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check pre op balances
        assertEq(wsteth.balanceOf(address(teller)), wstethInAmount);
        assertEq(weth.balanceOf(address(teller)), 0);

        // Execute operation
        vm.prank(BUNDLER);
        teller.processBundle(bundle);

        // Check post op balances
        assertEq(wsteth.balanceOf(address(teller)), 0);
        assertGe(weth.balanceOf(address(teller)), wethExpectedOutAmount);
    }
}
