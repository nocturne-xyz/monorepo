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
import "../interfaces/IUniswapV3.sol";

contract WstethTest is Test {
    IWeth public constant weth =
        IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IWsteth public constant wsteth =
        IWsteth(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    IUniswapV3 public constant uniswap =
        IUniswapV3(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    IBalancer public constant balancer =
        IBalancer(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    bytes32 public constant WSTETH_WETH_POOL_ID =
        bytes32(
            0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080
        );
    bytes32 public constant WSTETH_SFRXETH_RETH_POOL_ID =
        bytes32(
            0x42ed016f826165c2e5976fe5bc3df540c5ad0af700000000000000000000058b
        );
    bytes32 public constant RETH_WETH_POOL_ID =
        bytes32(
            0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112
        );
    address public constant RETH_ADDRESS =
        address(0xae78736Cd615f374D3085123A210448E74Fc6393);

    address public constant DEPOSIT_SOURCE = address(0x111);
    address public constant ALICE = address(0x222);
    address public constant BUNDLER = address(0x333);

    Teller teller;
    Handler handler;
    WstethAdapter wstethAdapter;
    FundManagement balancerFundManagement;

    function setUp() public {
        wstethAdapter = new WstethAdapter(address(weth), address(wsteth));
        teller = new Teller();
        handler = new Handler();

        balancerFundManagement = FundManagement({
            sender: address(handler),
            recipient: payable(address(handler)),
            fromInternalBalance: false,
            toInternalBalance: false
        });

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

        // Whitelist weth, wsteth, wsteth adapter, and balancer
        handler.setContractPermission(address(weth), true);
        handler.setContractPermission(address(wsteth), true);
        handler.setContractPermission(address(wstethAdapter), true);
        handler.setContractPermission(address(balancer), true);

        // Whitelist weth approve, wsteth approve, wsteth adapter convert, and balancer swap/batchSwap
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
        handler.setContractMethodPermission(
            address(balancer),
            balancer.batchSwap.selector,
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

    function testWstethSingleDeposit(uint256 wethInAmount) public {
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

        address[] memory outputTokens = new address[](1);
        outputTokens[0] = address(wsteth);
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
                        NocturneUtils.fillJoinSplitPublicSpends(wethInAmount, 1)
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

    // TODO: test multiple wsteth deposits

    function testUniswapDirectSwapWstethForWeth(uint256 wstethInAmount) public {
        // NOTE: hardcode upper bound based on Balancer weth/wsteth pool liquidity ~5000 wsteth
        wstethInAmount = bound(wstethInAmount, 10000, 2000 ether);
        reserveAndDeposit(address(wsteth), wstethInAmount);

        console.log("wstethInAmount", wstethInAmount);

        // Get expected weth out amount, 5% slippage tolerance
        uint256 wethExpectedOutAmount = (wsteth.getStETHByWstETH(
            wstethInAmount
        ) * 95) / 100;

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
    }

    // TODO: test uniswap multihop

    function testBalancerDirectSwapWstethForWeth(
        uint256 wstethInAmount
    ) public {
        // NOTE: hardcode upper bound based on Balancer weth/wsteth pool liquidity ~5000 wsteth
        wstethInAmount = bound(wstethInAmount, 10000, 2000 ether);
        reserveAndDeposit(address(wsteth), wstethInAmount);

        console.log("wstethInAmount", wstethInAmount);

        // Get expected weth out amount, 5% slippage tolerance
        uint256 wethExpectedOutAmount = (wsteth.getStETHByWstETH(
            wstethInAmount
        ) * 95) / 100;

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
            poolId: WSTETH_WETH_POOL_ID,
            kind: SwapKind.GIVEN_IN,
            assetIn: IAsset(address(wsteth)),
            assetOut: IAsset(address(weth)),
            amount: wstethInAmount,
            userData: bytes("")
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
                balancerFundManagement,
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

    function testBalancerBatchSwapWstethToWeth(uint256 wstethInAmount) public {
        // TODO: why is it that the batch swap fails when the wstethInAmount < 10k wei?
        wstethInAmount = bound(wstethInAmount, 100_000, 1000 ether);
        reserveAndDeposit(address(wsteth), wstethInAmount);

        console.log("wstethInAmount", wstethInAmount);

        // Get expected weth out amount, 5% slippage tolerance
        uint256 wethExpectedOutAmount = (wsteth.getStETHByWstETH(
            wstethInAmount
        ) * 95) / 100;

        console.log("wethExpectedOutAmount", wethExpectedOutAmount);

        // Format weth as the refund asset
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(weth),
                ERC20_ID
            ),
            minRefundValue: wethExpectedOutAmount
        });

        // List assets in route: wsteth, reth, weth
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(address(wsteth));
        assets[1] = IAsset(RETH_ADDRESS);
        assets[2] = IAsset(address(weth));

        BatchSwapStep[] memory swapSteps = new BatchSwapStep[](2);

        // wsteth -> reth
        swapSteps[0] = BatchSwapStep({
            poolId: WSTETH_SFRXETH_RETH_POOL_ID,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: wstethInAmount,
            userData: bytes("")
        });

        // reth -> weth
        swapSteps[1] = BatchSwapStep({
            poolId: RETH_WETH_POOL_ID,
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0, // defaults to however much was returned by prev swaps
            userData: bytes("")
        });

        // TODO: figure out how to actually set these limits
        int256[] memory limits = new int256[](3);
        limits[0] = int256(type(int256).max);
        limits[1] = int256(type(int256).max);
        limits[2] = int256(type(int256).max);

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
                balancer.batchSwap.selector,
                SwapKind.GIVEN_IN,
                swapSteps,
                assets,
                balancerFundManagement,
                limits,
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
                executionGasLimit: 500_000,
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
