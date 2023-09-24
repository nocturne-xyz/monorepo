//SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {ForkBase} from "./ForkBase.sol";
import {IWeth} from "../../interfaces/IWeth.sol";
import {IReth} from "../../interfaces/IReth.sol";
import {RethAdapter} from "../../adapters/RethAdapter.sol";
import {IRocketStorage} from "../../interfaces/IRocketStorage.sol";
import {IRocketDepositPool} from "../../interfaces/IRocketDepositPool.sol";
import {IRocketDAOProtocolSettingsDeposit} from "../interfaces/IRocketDAOProtocolSettingsDeposit.sol";
import {IRocketMinipoolQueue} from "../interfaces/IRocketMinipoolQueue.sol";
import "../../libs/Types.sol";
import "../../libs/AssetUtils.sol";
import "../utils/NocturneUtils.sol";

contract RethTest is ForkBase {
    IWeth public constant weth =
        IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IReth public constant reth =
        IReth(address(0xae78736Cd615f374D3085123A210448E74Fc6393));

    IRocketStorage public constant rocketStorage =
        IRocketStorage(address(0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46));
    // uint256 public constant ROCKET_MAX_DEPOSIT_POOL_SIZE = 18_000 ether;

    RethAdapter rethAdapter;

    function setUp() public {
        baseSetUp();

        rethAdapter = new RethAdapter(address(weth), address(rocketStorage));

        // Whitelist weth, reth, reth adapter
        handler.setContractPermission(address(weth), true);
        handler.setContractPermission(address(reth), true);
        handler.setContractPermission(address(rethAdapter), true);

        // Whitelist weth approve, reth deposit
        handler.setContractMethodPermission(
            address(weth),
            weth.approve.selector,
            true
        );
        handler.setContractMethodPermission(
            address(rethAdapter),
            rethAdapter.convert.selector,
            true
        );

        // Prefill tokens
        deal(address(weth), address(handler), 1);
        deal(address(reth), address(handler), 1);
    }

    function testRethSingleDeposit(uint256 wethInAmount) public {
        IRocketDepositPool rocketDepositPool = IRocketDepositPool(
            rocketStorage.getAddress(
                keccak256(
                    abi.encodePacked("contract.address", "rocketDepositPool")
                )
            )
        );
        IRocketDAOProtocolSettingsDeposit rocketDAOProtocolSettingsDeposit = IRocketDAOProtocolSettingsDeposit(
                rocketStorage.getAddress(
                    keccak256(
                        abi.encodePacked(
                            "contract.address",
                            "rocketDAOProtocolSettingsDeposit"
                        )
                    )
                )
            );
        IRocketMinipoolQueue rocketMinipoolQueue = IRocketMinipoolQueue(
            rocketStorage.getAddress(
                keccak256(
                    abi.encodePacked("contract.address", "rocketMinipoolQueue")
                )
            )
        );
        uint256 currentRocketDepositBalance = rocketDepositPool.getBalance();
        uint256 maxDepositLimit = rocketDAOProtocolSettingsDeposit
            .getMaximumDepositPoolSize();
        uint256 minipoolQueueSize = rocketMinipoolQueue.getEffectiveCapacity();

        console.log("currentRocketDepositBalance", currentRocketDepositBalance);
        console.log("maxDepositLimit", maxDepositLimit);
        console.log("minipoolQueueSize", minipoolQueueSize);

        // NOTE: rocket pool minimum amount is 0.01 ETH so higher lower bound than normal
        wethInAmount = bound(
            wethInAmount,
            10000000000000000,
            maxDepositLimit + minipoolQueueSize - currentRocketDepositBalance
        );
        reserveAndDeposit(address(weth), wethInAmount);

        uint256 rethExpectedOutAmount = reth.getRethValue(wethInAmount);

        // Format weth as refund asset
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(reth),
                ERC20_ID
            ),
            minRefundValue: (rethExpectedOutAmount * 99) / 100 // TODO: 1% buffer, figure out where actual exchange rate comes from that's used in UI (doesn't match getRethValue)
        });

        // Format actions
        Action[] memory actions = new Action[](2);
        actions[0] = Action({
            contractAddress: address(weth),
            encodedFunction: abi.encodeWithSelector(
                weth.approve.selector,
                address(rethAdapter),
                wethInAmount
            )
        });
        actions[1] = Action({
            contractAddress: address(rethAdapter),
            encodedFunction: abi.encodeWithSelector(
                rethAdapter.convert.selector,
                wethInAmount
            )
        });

        // Create operation to convert weth to reth
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
                executionGasLimit: 10_000_000, // large gas limit
                gasPrice: 0,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check pre op balances
        assertEq(weth.balanceOf(address(teller)), wethInAmount);
        assertEq(reth.balanceOf(address(teller)), 0);

        // Execute operation
        vm.prank(BUNDLER);
        teller.processBundle(bundle);

        // Check post op balances
        assertEq(weth.balanceOf(address(teller)), 0);
        assertGe(
            reth.balanceOf(address(teller)),
            (rethExpectedOutAmount * 99) / 100
        ); // TODO: 1% buffer, figure out where actual exchange rate comes from that's used in UI (doesn't match getRethValue)
    }
}
