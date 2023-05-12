// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IJoinSplitVerifier} from "../../interfaces/IJoinSplitVerifier.sol";
import {ISubtreeUpdateVerifier} from "../../interfaces/ISubtreeUpdateVerifier.sol";
import {LibOffchainMerkleTree, OffchainMerkleTree} from "../../libs/OffchainMerkleTree.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import {OperationUtils} from "../../libs/OperationUtils.sol";
import {Teller} from "../../Teller.sol";
import {TestBalanceManager} from "../harnesses/TestBalanceManager.sol";
import "../utils/NocturneUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {Utils} from "../../libs/Utils.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";

contract BalanceManagerTest is Test {
    using LibOffchainMerkleTree for OffchainMerkleTree;
    using stdJson for string;
    using OperationLib for Operation;

    // Check storage layout file
    uint256 constant OPERATION_STAGE_STORAGE_SLOT = 225;
    uint256 constant NOT_ENTERED = 1;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant BUNDLER = address(3);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    uint256 constant DEFAULT_PER_JOINSPLIT_VERIFY_GAS = 170_000;

    TestBalanceManager balanceManager;
    Teller teller;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    SimpleERC1155Token[3] ERC1155s;

    function setUp() public virtual {
        // Instantiate teller, joinSplitVerifier, tree, and balanceManager
        teller = new Teller();
        balanceManager = new TestBalanceManager();

        joinSplitVerifier = new TestJoinSplitVerifier();
        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager.initialize(
            address(teller),
            address(subtreeUpdateVerifier)
        );

        // NOTE: TestBalanceManager implements IHandler so we can test with
        // teller
        teller.initialize(address(balanceManager), address(joinSplitVerifier));
        teller.setDepositSourcePermission(ALICE, true);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();
        }
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        StealthAddress memory addr = NocturneUtils.defaultStealthAddress();
        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            recipient,
            address(token),
            amount,
            ERC20_ID,
            addr,
            0, // nonce and gasPrice irrelevant
            0
        );

        vm.prank(recipient);
        token.approve(address(teller), amount);

        vm.prank(ALICE);
        teller.depositFunds(deposit);
    }

    function testMakeDeposit() public {
        SimpleERC20Token token = ERC20s[0];
        uint256 depositAmount = 10;

        // Pre-deposit state
        assertEq(balanceManager.totalCount(), 0);
        assertEq(token.balanceOf(address(teller)), 0);

        reserveAndDepositFunds(ALICE, token, depositAmount);

        // Post-deposit state
        assertEq(balanceManager.totalCount(), 1);
        assertEq(token.balanceOf(address(teller)), depositAmount);
    }

    function testProcessJoinSplitsGasPriceZero() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Balance manager took up 100M of token
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(token.balanceOf(address(balanceManager)), 100_000_000);
    }

    function testProcessJoinSplitsReservingFeeSingleFeeNote() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token with gas price of 50 (see total
        // fee below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // gasPrice * (providedExecutionGas + gasPerJoinSplit + gasPerRefund)
        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 totalFeeReserved = balanceManager.calculateOpMaxGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Balance manager took up 50M, left 50M for bundler
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved
        );
        assertEq(token.balanceOf(address(teller)), totalFeeReserved);
    }

    function testProcessJoinSplitsReservingFeeTwoFeeNotes() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 150M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 3);

        // Unwrap 150M and setting gas price to 50. 2 joinsplits needed for
        // calculated fee (see below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    3
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // gasPrice * (executionGas + joinSplitGas + refundGas)
        // 50 * (500k + (3 * 170k) + (3 * 80k)) = 62.5M
        uint256 totalFeeReserved = balanceManager.calculateOpMaxGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Balance manager took up 150M - 62.5M
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) - totalFeeReserved
        );
        assertEq(token.balanceOf(address(teller)), totalFeeReserved);
    }

    function testProcessJoinSplitsReservingFeeAndPayBundler() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M and set gas price to 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // 50 * (executionGas + (2 * joinSplitGas) + (2 * refundGas))
        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 totalFeeReserved = balanceManager.calculateOpMaxGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Take up 100M tokens
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved
        );

        // Only bundler fee: 50 * (executionGas + verificationGas + handleJoinSplitGas + handleRefundGas)
        // 50 * (500k + (2 * 170k) + (2 * 50k)) = 47M
        // NOTE: verification gas defaults to numJoinSplits * GAS_PER_JOINSPLIT_VERIFY formatDummyOperationResult defaults to this
        OperationResult memory opResult = NocturneUtils
            .formatDummyOperationResult(op);
        uint256 onlyBundlerFee = balanceManager.calculateBundlerGasAssetPayout(
            op,
            opResult
        );

        balanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS,
            BUNDLER
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - onlyBundlerFee
        );
        assertEq(token.balanceOf(BUNDLER), onlyBundlerFee);

        // TODO: pay out subtree updater
    }

    function testProcessJoinSplitsFailureNotEnoughForFee() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens (we will see gas comp is 62.5M)
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        // Unwrap 50M, not enough for bundler comp with 3 joinsplits and gas
        // price of 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT / 3,
                    3
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // gasPrice * (executionGas + joinSplitGas + refundGas)
        // 50 * (500k + (3 * 170k) + (3 * 80k)) = 62.5M
        // NOTE: we only deposited 50M
        uint256 totalFeeReserved = balanceManager.calculateOpMaxGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertGt(totalFeeReserved, PER_NOTE_AMOUNT);

        // Expect revert due to not having enough to pay fee
        vm.expectRevert("Too few gas tokens");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureNotEnoughFundsForUnwrap() public {
        SimpleERC20Token token = ERC20s[0];

        // Only reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Attempts to unwrap 100M of token (we only deposited 50M)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureBadRoot() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Operation with bad merkle root fails joinsplit processing
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.JOINSPLIT_BAD_ROOT
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("Tree root not past root");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureAlreadyUsedNullifier() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType
                    .JOINSPLIT_NF_ALREADY_IN_SET
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("Nullifier B already used");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureMatchingNullifiers() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Create operation with one of the joinsplits has matching NFs A and B
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.JOINSPLIT_NFS_SAME
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("2 nfs should !equal");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testHandleRefundsJoinSplitsSingleAsset() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0, // don't reserve any gas, teller takes up all
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Take up 100M tokens
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(teller)), 0);

        // Expect all 100M to be refunded to teller
        balanceManager.handleAllRefunds(op);
        assertEq(token.balanceOf(address(balanceManager)), 0);
        assertEq(token.balanceOf(address(teller)), (2 * PER_NOTE_AMOUNT));
    }

    function testHandleRefundsRefundAssetsSingleAsset() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        SimpleERC20Token refundToken = ERC20s[1];

        // Refund asset
        EncodedAsset[] memory refundAssets = new EncodedAsset[](1);
        refundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(refundToken),
            ERC20_ID
        );

        // Dummy operation, we're only interested in refundAssets
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: joinSplitToken,
                gasToken: joinSplitToken,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: refundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Send refund tokens to balance manager
        uint256 refundAmount = 10_000_000;
        refundToken.reserveTokens(ALICE, refundAmount);
        vm.prank(ALICE);
        refundToken.transfer(address(balanceManager), refundAmount);

        // Expect all refund tokens to be refunded to teller
        balanceManager.handleAllRefunds(op);
        assertEq(refundToken.balanceOf(address(balanceManager)), 0);
        assertEq(refundToken.balanceOf(address(teller)), refundAmount);
    }

    function testPrefillAssetAndHandleRefundsJoinSplitAndRefundTokens() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        SimpleERC20Token refundToken = ERC20s[1];

        // Joinsplit asset
        EncodedAsset memory joinSplitAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(joinSplitToken),
            ERC20_ID
        );

        // Refund asset
        EncodedAsset[] memory refundAssets = new EncodedAsset[](1);
        EncodedAsset memory refundAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(refundToken),
            ERC20_ID
        );
        refundAssets[0] = refundAsset;

        // Transfer contract ownership to alice
        balanceManager.transferOwnership(ALICE);

        // Reserve prefill tokens for alice
        joinSplitToken.reserveTokens(address(ALICE), 1);
        refundToken.reserveTokens(address(ALICE), 1);

        // Prefill with 1 unit of each token
        vm.startPrank(ALICE);
        joinSplitToken.approve(address(balanceManager), 1);
        refundToken.approve(address(balanceManager), 1);

        balanceManager.addToAssetPrefill(joinSplitAsset, 1);

        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(NOT_ENTERED)
        );
        balanceManager.addToAssetPrefill(refundAsset, 1);
        vm.stopPrank();

        // Assert mappings and balances reflect the +1s
        assertEq(
            balanceManager._prefilledAssetBalances(
                AssetUtils.hashEncodedAsset(joinSplitAsset)
            ),
            1
        );
        assertEq(
            balanceManager._prefilledAssetBalances(
                AssetUtils.hashEncodedAsset(refundAsset)
            ),
            1
        );
        assertEq(joinSplitToken.balanceOf(address(balanceManager)), 1);
        assertEq(refundToken.balanceOf(address(balanceManager)), 1);

        // Dummy operation, we manually send 10M joinsplit tokens to balance
        // manager directly because no actual unwrapping occurs
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: joinSplitToken,
                gasToken: joinSplitToken,
                root: balanceManager.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: refundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 2,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        joinSplitToken.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        vm.prank(ALICE);
        joinSplitToken.transfer(address(balanceManager), PER_NOTE_AMOUNT);

        // Send refund tokens to balance manager
        uint256 refundAmount = 10_000_000;
        refundToken.reserveTokens(ALICE, refundAmount);
        vm.prank(ALICE);
        refundToken.transfer(address(balanceManager), refundAmount);

        // Assert balance manager has amount + 1 before handling refunds
        assertEq(
            joinSplitToken.balanceOf(address(balanceManager)),
            PER_NOTE_AMOUNT + 1
        );
        assertEq(
            refundToken.balanceOf(address(balanceManager)),
            refundAmount + 1
        );

        // Expect all refund tokens to be refunded to teller barring the
        // prefilled 1s
        balanceManager.handleAllRefunds(op);

        assertEq(joinSplitToken.balanceOf(address(balanceManager)), 1);
        assertEq(joinSplitToken.balanceOf(address(teller)), PER_NOTE_AMOUNT);

        assertEq(refundToken.balanceOf(address(balanceManager)), 1);
        assertEq(refundToken.balanceOf(address(teller)), refundAmount);
    }
}
