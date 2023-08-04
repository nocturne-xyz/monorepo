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
import {Utils} from "../../libs/Utils.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";

contract BalanceManagerTest is Test {
    using LibOffchainMerkleTree for OffchainMerkleTree;
    using stdJson for string;
    using OperationLib for Operation;

    // Check storage layout file
    uint256 constant OPERATION_STAGE_STORAGE_SLOT = 277;
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

    function setUp() public virtual {
        // Instantiate teller, joinSplitVerifier, tree, and balanceManager
        teller = new Teller();
        balanceManager = new TestBalanceManager();

        joinSplitVerifier = new TestJoinSplitVerifier();
        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager.initialize(
            address(subtreeUpdateVerifier),
            address(0x111)
        );
        balanceManager.setTeller(address(teller));

        // NOTE: TestBalanceManager implements IHandler so we can test with
        // teller
        teller.initialize(
            "NocturneTeller",
            "v1",
            address(balanceManager),
            address(joinSplitVerifier)
        );
        teller.setDepositSourcePermission(ALICE, true);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();

            // Prefill the balance manager with 1 token
            ERC20s[i].reserveTokens(address(balanceManager), 1);
        }
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        CompressedStealthAddress memory addr = NocturneUtils
            .defaultStealthAddress();
        Deposit memory deposit = NocturneUtils.formatDeposit(
            recipient,
            address(token),
            amount,
            ERC20_ID,
            addr
        );

        vm.prank(recipient);
        token.approve(address(teller), amount);

        vm.prank(ALICE);
        teller.depositFunds(deposit);
    }

    function testMakeDepositSuccess() public {
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

    function testProcessJoinSplitsGasPriceZeroSuccess() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Balance manager took up 100M of token
        assertEq(token.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (PER_NOTE_AMOUNT * 2) + 1
        );
    }

    function testProcessJoinSplitsReservingFeeSingleFeeNoteSuccess() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 100M of token with gas price of 50 (see total
        // fee below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasAssetRefundThreshold: 0,
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
        assertEq(token.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
        );
        assertEq(token.balanceOf(address(teller)), totalFeeReserved);
    }

    function testProcessJoinSplitsThreeContiguousJoinSplitSubarraysMultiAssetSuccess()
        public
    {
        SimpleERC20Token token1 = ERC20s[0];
        SimpleERC20Token token2 = ERC20s[1];
        SimpleERC20Token token3 = ERC20s[2];

        // Reserves + deposits 150M of token
        reserveAndDepositFunds(ALICE, token1, PER_NOTE_AMOUNT * 3);
        reserveAndDepositFunds(ALICE, token2, PER_NOTE_AMOUNT * 3);
        reserveAndDepositFunds(ALICE, token3, PER_NOTE_AMOUNT * 3);

        address[] memory tokens = new address[](3);
        tokens[0] = address(token1);
        tokens[1] = address(token2);
        tokens[2] = address(token3);

        uint256[][] memory joinSplitsPublicSpends = new uint256[][](3);
        for (uint256 i = 0; i < 3; i++) {
            joinSplitsPublicSpends[i] = NocturneUtils.fillJoinSplitPublicSpends(
                PER_NOTE_AMOUNT,
                3
            );
        }

        // Unwrap 150M and setting gas price to 50. 2 joinsplits needed for
        // calculated fee (see below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: tokens,
                joinSplitRefundValues: new uint256[](tokens.length),
                gasToken: address(token1),
                root: balanceManager.root(),
                joinSplitsPublicSpends: joinSplitsPublicSpends,
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
        assertEq(token1.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token1.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
        );
        assertEq(
            token2.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) + 1
        );
        assertEq(
            token3.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) + 1
        );
        assertEq(token1.balanceOf(address(teller)), totalFeeReserved);
    }

    function testProcessJoinSplitsReservingFeeTwoFeeNotesSuccess() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 150M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 3);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 150M and setting gas price to 50. 2 joinsplits needed for
        // calculated fee (see below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            3
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
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
        assertEq(token.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
        );
        assertEq(token.balanceOf(address(teller)), totalFeeReserved);
    }

    function testGatherReservedGasAssetAndPayBundlerSuccess() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 100M and set gas price to 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

        // Take up 50M tokens (50M reserved)
        assertEq(token.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
        );

        // Only bundler fee: 50 * (executionGas + verificationGas + handleJoinSplitGas + handleRefundGas)
        // 50 * (500k + (2 * 170k) + (2 * 50k)) = 47M
        // NOTE: verification gas defaults to numJoinSplits * GAS_PER_JOINSPLIT_VERIFY formatDummyOperationResult defaults to this to ensure bundler fee is not whole reserved amnt
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
            (2 * PER_NOTE_AMOUNT) - onlyBundlerFee + 1
        );
        assertEq(token.balanceOf(BUNDLER), onlyBundlerFee);
    }

    function testGatherReservedGasAssetAndPayBundlerBelowRefundThresholdSuccess()
        public
    {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 100M and set gas price to 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                // threshold = sum(publicSpend) means it will always pay bundler whole amount
                gasAssetRefundThreshold: 2 * PER_NOTE_AMOUNT,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

        // Take up 50M tokens, reserving 50M
        assertEq(token.balanceOf(address(balanceManager)), 1); // +1 since prefill
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
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

        // What the bundler would've been paid is less than totalFeeReserved (special case now because of gasAssetRefundThreshold)
        assertLt(onlyBundlerFee, totalFeeReserved);

        balanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS,
            BUNDLER
        );

        // assert entire fee reserved went to bundler this time due to high refund threshold
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved + 1
        );
        assertEq(token.balanceOf(BUNDLER), totalFeeReserved);
    }

    function testProcessJoinSplitsNotEnoughForFeeFailure() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens (we will see gas comp is 62.5M)
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 50M, not enough for bundler comp with 3 joinsplits and gas
        // price of 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT / 3,
                            3
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
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

    function testProcessJoinSplitsNotEnoughFundsForUnwrapFailure() public {
        SimpleERC20Token token = ERC20s[0];

        // Only reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Attempts to unwrap 100M of token (we only deposited 50M)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

    function testProcessJoinSplitsBadRootFailure() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Operation with bad merkle root fails joinsplit processing
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

    function testProcessJoinSplitsAlreadyUsedNullifierFailure() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: new Action[](0),
                atomicActions: false,
                operationFailureType: OperationFailureType
                    .JOINSPLIT_NF_ALREADY_IN_SET
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("Nullifier A already used");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsMatchingNullifiersFailure() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation with one of the joinsplits has matching NFs A and B
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

    function testHandleRefundsJoinSplitsSingleAssetSuccess() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 100M of token
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
            (2 * PER_NOTE_AMOUNT) + 1 // +1 due to prefill
        );
        assertEq(token.balanceOf(address(teller)), 0);

        // Expect all 100M to be refunded to teller
        balanceManager.handleAllRefunds(op);
        assertEq(token.balanceOf(address(balanceManager)), 1);
        assertEq(token.balanceOf(address(teller)), (2 * PER_NOTE_AMOUNT));
    }

    function testHandleRefundsRefundAssetsSingleAssetSuccess() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        SimpleERC20Token refundToken = ERC20s[1];

        // Refund asset
        EncodedAsset[] memory refundAssets = new EncodedAsset[](1);
        refundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(refundToken),
            ERC20_ID
        );

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(refundToken),
                ERC20_ID
            ),
            minRefundValue: 0
        });

        // Dummy operation, we're only interested in refundAssets
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(joinSplitToken)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(joinSplitToken),
                root: balanceManager.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            2
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
        assertEq(refundToken.balanceOf(address(balanceManager)), 1); // +1 due to prefill
        assertEq(refundToken.balanceOf(address(teller)), refundAmount);
    }
}
