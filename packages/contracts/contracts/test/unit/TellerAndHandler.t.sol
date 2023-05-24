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
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../utils//PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "../utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import {ReentrantCaller} from "../utils/ReentrantCaller.sol";
import {TokenSwapper, SwapRequest} from "../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../utils/TreeTest.sol";
import "../utils/NocturneUtils.sol";
import "../utils/ForgeUtils.sol";
import {TestHandler} from "../harnesses/TestHandler.sol";
import {Teller} from "../../Teller.sol";
import {CommitmentTreeManager} from "../../CommitmentTreeManager.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Utils} from "../../libs/Utils.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";

contract TellerAndHandlerTest is Test, ForgeUtils, PoseidonDeployer {
    using LibOffchainMerkleTree for OffchainMerkleTree;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    // Check storage layout file
    uint256 constant OPERATION_STAGE_STORAGE_SLOT = 277;
    uint256 constant ENTERED_EXECUTE_ACTIONS = 3;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant BUNDLER = address(3);
    address constant DEPOSIT_SOURCE = address(3);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    Teller teller;
    TestHandler handler;
    TreeTest treeTest;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    SimpleERC1155Token[3] ERC1155s;
    IHasherT3 hasherT3;
    IHasherT5 hasherT5;
    IHasherT6 hasherT6;

    event DepositSourcePermissionSet(address source, bool permission);

    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    event RefundProcessed(
        StealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplitProcessed(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplit joinSplit
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        teller = new Teller();
        handler = new TestHandler();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        handler.initialize(address(teller), address(subtreeUpdateVerifier));
        teller.initialize(address(handler), address(joinSplitVerifier));

        teller.setDepositSourcePermission(DEPOSIT_SOURCE, true);
        handler.setSubtreeBatchFillerPermission(address(this), true);

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT5 = IHasherT5(new PoseidonHasherT5(poseidonT5));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT3, hasherT5, hasherT6);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();

            // Prefill the handler with 1 token
            ERC20s[i].reserveTokens(address(handler), 1);

            handler.setSupportedContractAllowlistPermission(
                address(ERC20s[i]),
                true
            );
            handler.setSupportedContractAllowlistPermission(
                address(ERC721s[i]),
                true
            );
            handler.setSupportedContractAllowlistPermission(
                address(ERC1155s[i]),
                true
            );
        }
    }

    function depositFunds(
        address spender,
        SimpleERC20Token token,
        uint256 value,
        uint256 id,
        StealthAddress memory depositAddr
    ) public {
        // Transfer to deposit source first
        vm.prank(spender);
        token.transfer(DEPOSIT_SOURCE, value);

        vm.startPrank(DEPOSIT_SOURCE);
        token.approve(address(teller), value);
        teller.depositFunds(
            NocturneUtils.formatDeposit(
                spender,
                address(token),
                value,
                id,
                depositAddr
            )
        );
        vm.stopPrank();
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        uint256[] memory batch = new uint256[](16);

        uint256 remainder = amount % PER_NOTE_AMOUNT;
        uint256 depositIterations = remainder == 0
            ? amount / PER_NOTE_AMOUNT
            : amount / PER_NOTE_AMOUNT + 1;

        // Deposit funds to teller
        for (uint256 i = 0; i < depositIterations; i++) {
            StealthAddress memory addr = NocturneUtils.defaultStealthAddress();
            vm.expectEmit(true, true, true, true);
            emit RefundProcessed(
                addr,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                PER_NOTE_AMOUNT,
                uint128(i)
            );

            if (i == depositIterations - 1 && remainder != 0) {
                depositFunds(recipient, token, remainder, ERC20_ID, addr);
            } else {
                depositFunds(recipient, token, PER_NOTE_AMOUNT, ERC20_ID, addr);
            }

            EncodedNote memory note = EncodedNote(
                addr.h1X,
                addr.h2X,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                100
            );
            uint256 noteCommitment = treeTest.computeNoteCommitment(note);

            batch[i] = noteCommitment;
        }

        uint256[][3] memory path = treeTest.computeInitialPaths(batch);
        uint256 root = path[0][path[0].length - 1];

        // fill the tree batch
        handler.fillBatchWithZeros();
        handler.applySubtreeUpdate(root, NocturneUtils.dummyProof());
    }

    function testTellerPauseUnpauseOnlyCallableByOwner() public {
        vm.startPrank(BOB); // Not owner
        vm.expectRevert("Ownable: caller is not the owner");
        teller.pause();
        vm.expectRevert("Ownable: caller is not the owner");
        teller.unpause();
        vm.stopPrank();

        vm.startPrank(address(this));
        teller.pause();
        assertEq(teller.paused(), true);

        teller.unpause();
        assertEq(teller.paused(), false);
        vm.stopPrank();
    }

    function testHandlerPauseUnpauseOnlyCallableByOwner() public {
        vm.startPrank(BOB); // Not owner
        vm.expectRevert("Ownable: caller is not the owner");
        handler.pause();
        vm.expectRevert("Ownable: caller is not the owner");
        handler.unpause();
        vm.stopPrank();

        vm.startPrank(address(this));
        handler.pause();
        assertEq(handler.paused(), true);
        handler.unpause();
        assertEq(handler.paused(), false);
        vm.stopPrank();
    }

    function testPausableWorksOnTeller() public {
        vm.prank(address(this));
        teller.pause();

        SimpleERC20Token token = ERC20s[0];
        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            ERC20_ID
        );

        // Create dummy deposit
        Deposit memory deposit = Deposit({
            spender: ALICE,
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(token),
                ERC20_ID
            ),
            value: PER_NOTE_AMOUNT,
            depositAddr: NocturneUtils.defaultStealthAddress()
        });

        // Create dummy operation
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT / 2
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        vm.expectRevert("Pausable: paused");
        teller.depositFunds(deposit);
        vm.expectRevert("Pausable: paused");
        teller.processBundle(bundle);
        vm.expectRevert("Pausable: paused");
        vm.prank(address(handler));
        teller.requestAsset(encodedToken, 100);
    }

    function testPausableWorksOnHandler() public {
        vm.prank(address(this));
        handler.pause();

        SimpleERC20Token token = ERC20s[0];

        // Create dummy deposit
        Deposit memory deposit = Deposit({
            spender: ALICE,
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(token),
                ERC20_ID
            ),
            value: PER_NOTE_AMOUNT,
            depositAddr: NocturneUtils.defaultStealthAddress()
        });

        // Create dummy operation
        Operation memory operation = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT / 2
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        vm.expectRevert("Pausable: paused");
        vm.prank(address(teller));
        handler.handleDeposit(deposit);
        vm.expectRevert("Pausable: paused");
        vm.prank(address(teller));
        handler.handleOperation(operation, 100, ALICE);
        vm.expectRevert("Pausable: paused");
        vm.prank(address(handler));
        handler.executeActions(operation);
    }

    function testSetDepositSourcePermissionTellerFailsNotOwner() public {
        vm.prank(BOB); // not owner
        vm.expectRevert("Ownable: caller is not the owner");
        teller.setDepositSourcePermission(address(0x123), true);
    }

    function testSetDepositSourcePermissionSucceedsOwner() public {
        // Send from owner, succeeds
        vm.expectEmit(true, true, true, true);
        emit DepositSourcePermissionSet(address(0x123), true);
        vm.prank(address(this));
        teller.setDepositSourcePermission(address(0x123), true);
    }

    function testSetSubtreeBatchFillerHandler() public {
        vm.expectRevert("Only subtree batch filler");
        vm.prank(ALICE);
        handler.fillBatchWithZeros();

        vm.expectEmit(true, true, true, true);
        emit SubtreeBatchFillerPermissionSet(ALICE, true);
        handler.setSubtreeBatchFillerPermission(ALICE, true);

        // So batch is not empty
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        depositFunds(
            ALICE,
            token,
            PER_NOTE_AMOUNT,
            ERC20_ID,
            NocturneUtils.defaultStealthAddress()
        );

        vm.prank(ALICE);
        handler.fillBatchWithZeros();
        assertEq(handler.totalCount(), 16);
    }

    function testDepositNotDepositSource() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        vm.prank(ALICE);
        token.approve(address(teller), PER_NOTE_AMOUNT);

        vm.startPrank(ALICE); // msg.sender made to be ALICE not DEPOSIT_SOURCE
        vm.expectRevert("Only deposit source");
        teller.depositFunds(
            Deposit({
                spender: ALICE,
                encodedAsset: AssetUtils.encodeAsset(
                    AssetType.ERC20,
                    address(token),
                    ERC20_ID
                ),
                value: PER_NOTE_AMOUNT,
                depositAddr: NocturneUtils.defaultStealthAddress()
            })
        );
        vm.stopPrank();
    }

    // Token not supported in handler
    function testCompleteDepositFailureUnsupportedTokenContract() public {
        // Allow ALICE to direct deposit to teller
        teller.setDepositSourcePermission(ALICE, true);

        // Deploy and dep manager whitelist new token but not in handler
        SimpleERC20Token token = new SimpleERC20Token();
        token.reserveTokens(ALICE, PER_NOTE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(teller), PER_NOTE_AMOUNT);

        Deposit memory deposit = NocturneUtils.formatDeposit(
            ALICE,
            address(token),
            PER_NOTE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress()
        );

        vm.prank(ALICE);
        vm.expectRevert("!supported deposit asset");
        teller.depositFunds(deposit);
    }

    function testProcessBundleTransferSingleJoinSplitWithBundlerComp() public {
        // Alice starts with 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        // Create operation to transfer 25M tokens to bob of 50M note
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT / 2
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 for prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 25M sent by alice
        // Expect teller to have alice's remaining 25M - gasComp
        // Expect BUNDLER to have > 0 gas tokens
        assertLt(
            token.balanceOf(address(teller)),
            uint256(PER_NOTE_AMOUNT / 2)
        );
        assertGt(token.balanceOf(BUNDLER), 0);
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(ALICE), uint256(0));
        assertEq(token.balanceOf(BOB), uint256(PER_NOTE_AMOUNT / 2));
    }

    function testProcessBundleTransferThreeJoinSplit() public {
        // Alice starts with 3 * 50M in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 3 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    3
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 3,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(3 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 50M sent by alice
        // Expect teller to have alice's remaining 100M
        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleTransferSixJoinSplit() public {
        // Alice starts with 6 * 50M in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 6 * PER_NOTE_AMOUNT);

        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    6
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 6,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    4 * PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(6 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 for prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Expect BOB to have the 200M sent by alice
        // Expect teller to have alice's remaining 100M
        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(4 * PER_NOTE_AMOUNT));
    }

    function testProcessBundleFailureBadRoot() public {
        // Alice starts with 2 * 50M in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with faulty root, will cause revert in
        // handleJoinSplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.JOINSPLIT_BAD_ROOT
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "Tree root not past root",
                assetsUnwrapped: false
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assertEq(opResults[0].failureReason, "Tree root not past root");

        // No tokens are lost from teller because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureAlreadyUsedNullifier() public {
        // Alice starts with 2 * 50M in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType
                    .JOINSPLIT_NF_ALREADY_IN_SET
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "Nullifier B already used",
                assetsUnwrapped: false
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assertEq(opResults[0].failureReason, "Nullifier B already used");

        // No tokens are lost from teller because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureMatchingNullifiers() public {
        // Alice starts with 2 * 50M in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with one of the joinsplits has matching NFs A and B
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.JOINSPLIT_NFS_SAME
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "2 nfs should !equal",
                assetsUnwrapped: false
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assertEq(opResults[0].failureReason, "2 nfs should !equal");

        // No tokens are lost from teller because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessBundleFailureReentrancyProcessBundleIndirect() public {
        // Alice starts with 2 * 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        ReentrantCaller reentrantCaller = new ReentrantCaller(
            teller,
            handler,
            ERC20s[0]
        );

        // Encode action that calls reentrant contract
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(reentrantCaller),
            encodedFunction: abi.encodeWithSelector(
                reentrantCaller.reentrantProcessBundle.selector
            )
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist reentrantCaller for sake of simulation
        handler.setSupportedContractAllowlistPermission(
            address(reentrantCaller),
            true
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "ReentrancyGuard: reentrant call"
            )
        );

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens.
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    function testProcessBundleFailureReentrancyProcessBundleDirect() public {
        // Alice starts with 2 * 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when handler calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Encode action for handler to call itself via executeActions
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(teller),
            encodedFunction: abi.encodeWithSelector(
                teller.processBundle.selector,
                internalOp
            )
        });

        // Nest internal op into action where teller call itself via
        // executeActions
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "Cannot call the Nocturne Teller",
                assetsUnwrapped: true
            })
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].failureReason, "Cannot call the Nocturne Teller");

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    // TODO: move to Handler.t.sol
    function testProcessBundleFailureReentrancyHandleOperationHandlerCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when teller calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Encode action for teller to call itself via handleOperation
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(handler),
            encodedFunction: abi.encodeWithSelector(
                handler.handleOperation.selector,
                internalOp
            )
        });

        // Nest internal op into action where teller call itself via
        // handleOperation
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // op processed = false, as reentrancy revert happened before making the call
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist handler for sake of simulation
        handler.setSupportedContractAllowlistPermission(address(handler), true);

        // Op was processed but call result has reentry failure message
        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] failed, handleOperation only
        // callable by teller
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Only teller"
            )
        );

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens.
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    // TODO: move to Handler.t.sol
    function testProcessBundleFailureReentrancyExecuteActionsHandlerCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when handler calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Encode action for handler to call itself via executeActions
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(handler),
            encodedFunction: abi.encodeWithSelector(
                handler.executeActions.selector,
                internalOp
            )
        });

        // Nest internal op into action where teller call itself via
        // executeActions
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist handler for sake of simulation
        handler.setSupportedContractAllowlistPermission(address(handler), true);

        // Op was processed but call result has reentry failure message
        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Reentry into executeActions"
            )
        );

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens.
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    // Test failing calls
    function testProcessBundleFailureTransferNotEnoughFundsInActionNonAtomic()
        public
    {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by teller
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 2,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    3 * PER_NOTE_AMOUNT
                ), // Transfer amount exceeds withdrawn
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // op processed = true, as internal revert happened in action
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Use Bob as bundler for this call
        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] failed
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "transfer amount exceeds balance"
            )
        );

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens.
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    // Ensure bundle reverts if atomicActions = true and action fails
    function testProcessBundleFailureTransferNotEnoughFundsInActionAtomic()
        public
    {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by teller
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 2,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    3 * PER_NOTE_AMOUNT
                ), // Transfer amount exceeds withdrawn
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "ERC20: transfer amount exceeds balance",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // op processed = false, whole op reverted
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].callSuccesses.length, uint256(0));
        assertEq(opResults[0].callResults.length, uint256(0));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].failureReason),
                "transfer amount exceeds balance"
            )
        );

        // Alice lost some private balance due to bundler comp. Bundler has a
        // little bit of tokens.
        assertLt(
            token.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(handler)), uint256(1));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGt(token.balanceOf(address(BUNDLER)), uint256(0)); // Bundler gained funds
    }

    // Ensure op fails if it calls non-allowed swapper contract
    function testProcessBundleNonAllowedContract() public {
        SimpleERC20Token tokenIn = ERC20s[0];
        reserveAndDepositFunds(ALICE, tokenIn, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(tokenIn),
            encodedFunction: abi.encodeWithSelector(
                tokenIn.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20/721/1155 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];
        SimpleERC721Token erc721Out = ERC721s[1];
        SimpleERC1155Token erc1155Out = ERC1155s[1];

        uint256 erc721OutId = 0x1;
        uint256 erc1155OutId = 0x2;

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(erc721Out),
                    erc721OutId: erc721OutId,
                    erc1155Out: address(erc1155Out),
                    erc1155OutId: erc1155OutId,
                    erc1155OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20Out as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20Out),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                gasToken: tokenIn,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 4, // 4 refund assets (including joinsplit)
                gasPrice: 0,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(tokenIn.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1));
        assertEq(erc721Out.balanceOf(address(teller)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(teller), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!supported refund asset",
                assetsUnwrapped: true
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
    }

    function testProcessBundleSuccessfulAllRefunds() public {
        SimpleERC20Token tokenIn = ERC20s[0];
        reserveAndDepositFunds(ALICE, tokenIn, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(tokenIn),
            encodedFunction: abi.encodeWithSelector(
                tokenIn.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20/721/1155 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];
        SimpleERC721Token erc721Out = ERC721s[1];
        SimpleERC1155Token erc1155Out = ERC1155s[1];

        uint256 erc721OutId = 0x1;
        uint256 erc1155OutId = 0x2;

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(erc721Out),
                    erc721OutId: erc721OutId,
                    erc1155Out: address(erc1155Out),
                    erc1155OutId: erc1155OutId,
                    erc1155OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20Out as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20Out),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                gasToken: tokenIn,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 4, // 4 refund assets (including joinsplit)
                gasPrice: 0,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(tokenIn.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(erc721Out.balanceOf(address(teller)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(teller), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist token swapper for sake of simulation
        handler.setSupportedContractAllowlistPermission(address(swapper), true);

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, approve call and swap call both succeeded
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(2));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callSuccesses[1], true);
        assertEq(opResults[0].callResults.length, uint256(2));

        // Ensure 50M tokensIn in swapper, and all types of refund tokens back
        // in teller
        assertEq(tokenIn.balanceOf(address(handler)), uint256(1));
        assertEq(erc20Out.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc721Out.balanceOf(address(teller)), uint256(1));
        assertEq(erc721Out.ownerOf(erc721OutId), address(teller));
        assertEq(
            erc1155Out.balanceOf(address(teller), erc1155OutId),
            PER_NOTE_AMOUNT
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleFailureTooManyRefunds() public {
        SimpleERC20Token tokenIn = ERC20s[0];
        reserveAndDepositFunds(ALICE, tokenIn, 2 * PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(tokenIn),
            encodedFunction: abi.encodeWithSelector(
                tokenIn.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20/721/1155 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];
        SimpleERC721Token erc721Out = ERC721s[1];
        SimpleERC1155Token erc1155Out = ERC1155s[1];

        uint256 erc721OutId = 0x1;
        uint256 erc1155OutId = 0x2;

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(teller),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(erc721Out),
                    erc721OutId: erc721OutId,
                    erc1155Out: address(erc1155Out),
                    erc1155OutId: erc1155OutId,
                    erc1155OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20Out as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20Out),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                gasToken: tokenIn,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    2
                ),
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1, // should be 4 refund assets, 1 too few
                gasPrice: 50,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 100M tokensIn in teller and nothing else
        // Swapper has 0 erc20In tokens
        assertEq(
            tokenIn.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(erc20Out.balanceOf(address(teller)), uint256(0));
        assertEq(erc721Out.balanceOf(address(teller)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(teller), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "Too many refunds",
                assetsUnwrapped: true
            })
        );

        // Whitelist token swapper for sake of simulation
        handler.setSupportedContractAllowlistPermission(address(swapper), true);

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false, call[0] failed (too many refunds)
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].failureReason),
                "Too many refunds"
            )
        );

        // Teller lost some tokenIn to BUNDLER due to bundler gas fee, but
        // otherwise no state changes
        assertLt(
            tokenIn.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertGt(tokenIn.balanceOf(BUNDLER), 0);
        assertEq(erc20Out.balanceOf(address(teller)), uint256(0));
        assertEq(erc721Out.balanceOf(address(teller)), uint256(0));
        assertEq(
            erc1155Out.balanceOf(address(teller), erc1155OutId),
            uint256(0)
        );
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));
    }

    function testOnErc721ReceivedSuccessEnteredExecute() public {
        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(handler),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Token balance manager will receive
        SimpleERC721Token erc721 = ERC721s[0];
        uint256 tokenId = 1;
        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC721,
            address(erc721),
            tokenId
        );

        // Mint and send token to balance manager
        assertEq(handler.receivedAssetsLength(), 0);
        erc721.reserveToken(ALICE, tokenId);
        vm.prank(ALICE);
        erc721.safeTransferFrom(ALICE, address(handler), tokenId);

        // Ensure token was received
        assertEq(handler.receivedAssetsLength(), 1);
        EncodedAsset memory received = handler.getReceivedAssetsByIndex(0);
        assertEq(received.encodedAssetAddr, encodedToken.encodedAssetAddr);
        assertEq(received.encodedAssetId, encodedToken.encodedAssetId);
    }

    function testOnErc721ReceivedFailureNotEntered() public {
        // NOTE: we never override the reentrancy guard, thus stage = NOT_ENTERED

        // Token balance manager will receive
        SimpleERC721Token erc721 = ERC721s[0];
        uint256 tokenId = 1;

        // Expect safeTransferFrom to fail because balance stage = NOT_ENTERED
        assertEq(handler.receivedAssetsLength(), 0);
        erc721.reserveToken(ALICE, tokenId);
        vm.prank(ALICE);
        vm.expectRevert("ERC721: transfer to non ERC721Receiver implementer");
        erc721.safeTransferFrom(ALICE, address(handler), tokenId);
        assertEq(handler.receivedAssetsLength(), 0);
    }

    function testOnErc1155ReceivedSuccessEnteredExecute() public {
        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(handler),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Token balance manager will receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId = 1;
        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC1155,
            address(erc1155),
            tokenId
        );

        // Mint and send token to balance manager
        uint256 tokenAmount = 100;
        assertEq(erc1155.balanceOf(address(handler), tokenId), 0);
        assertEq(handler.receivedAssetsLength(), 0);
        erc1155.reserveTokens(ALICE, tokenId, tokenAmount);
        vm.prank(ALICE);
        erc1155.safeTransferFrom(
            ALICE,
            address(handler),
            tokenId,
            tokenAmount,
            bytes("")
        );

        // Ensure tokens were received
        assertEq(erc1155.balanceOf(address(handler), tokenId), tokenAmount);
        assertEq(handler.receivedAssetsLength(), 1);
        EncodedAsset memory received = handler.getReceivedAssetsByIndex(0);
        assertEq(received.encodedAssetAddr, encodedToken.encodedAssetAddr);
        assertEq(received.encodedAssetId, encodedToken.encodedAssetId);
    }

    function testOnErc1155ReceivedFailureNotEntered() public {
        // NOTE: we never override the reentrancy guard, thus stage = NOT_ENTERED

        // Token balance manager will attempt to receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId = 1;

        uint256 tokenAmount = 100;

        // Mint but transfer attempt will revert
        assertEq(handler.receivedAssetsLength(), 0);
        erc1155.reserveTokens(ALICE, tokenId, tokenAmount);
        vm.prank(ALICE);
        vm.expectRevert("ERC1155: ERC1155Receiver rejected tokens");
        erc1155.safeTransferFrom(
            ALICE,
            address(handler),
            tokenId,
            tokenAmount,
            bytes("")
        );
        assertEq(handler.receivedAssetsLength(), 0);
    }

    function testOnErc1155BatchReceivedSuccessEnteredExecute() public {
        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(handler),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Token balance manager will receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;
        EncodedAsset memory encodedToken1 = AssetUtils.encodeAsset(
            AssetType.ERC1155,
            address(erc1155),
            tokenId1
        );
        EncodedAsset memory encodedToken2 = AssetUtils.encodeAsset(
            AssetType.ERC1155,
            address(erc1155),
            tokenId2
        );

        // Mint and send token to balance manager
        uint256 tokenAmount = 100;
        assertEq(erc1155.balanceOf(address(handler), tokenId1), 0);
        assertEq(erc1155.balanceOf(address(handler), tokenId2), 0);
        assertEq(handler.receivedAssetsLength(), 0);
        erc1155.reserveTokens(ALICE, tokenId1, tokenAmount);
        erc1155.reserveTokens(ALICE, tokenId2, tokenAmount);

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = tokenAmount;
        amounts[1] = tokenAmount;

        vm.prank(ALICE);
        erc1155.safeBatchTransferFrom(
            ALICE,
            address(handler),
            tokenIds,
            amounts,
            bytes("")
        );

        // Ensure tokens were received
        assertEq(erc1155.balanceOf(address(handler), tokenId1), tokenAmount);
        assertEq(erc1155.balanceOf(address(handler), tokenId2), tokenAmount);
        assertEq(handler.receivedAssetsLength(), 2);

        EncodedAsset memory received1 = handler.getReceivedAssetsByIndex(0);
        EncodedAsset memory received2 = handler.getReceivedAssetsByIndex(1);
        assertEq(received1.encodedAssetAddr, encodedToken1.encodedAssetAddr);
        assertEq(received1.encodedAssetId, encodedToken1.encodedAssetId);
        assertEq(received2.encodedAssetAddr, encodedToken2.encodedAssetAddr);
        assertEq(received2.encodedAssetId, encodedToken2.encodedAssetId);
    }

    function testOnErc1155BatchReceivedFailureNotEntered() public {
        // NOTE: we never override the reentrancy guard, thus stage = NOT_ENTERED

        // Token balance manager will receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;

        // Mint and send token to balance manager
        uint256 tokenAmount = 100;

        erc1155.reserveTokens(ALICE, tokenId1, tokenAmount);
        erc1155.reserveTokens(ALICE, tokenId2, tokenAmount);

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = tokenAmount;
        amounts[1] = tokenAmount;

        vm.prank(ALICE);
        vm.expectRevert("ERC1155: ERC1155Receiver rejected tokens");
        erc1155.safeBatchTransferFrom(
            ALICE,
            address(handler),
            tokenIds,
            amounts,
            bytes("")
        );

        // Ensure tokens were not received
        assertEq(handler.receivedAssetsLength(), 0);
        assertEq(erc1155.balanceOf(address(handler), tokenId1), 0);
        assertEq(erc1155.balanceOf(address(handler), tokenId2), 0);
    }

    function testProcessBundleFailureNotEnoughBundlerComp() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        // Unwrap 50M, not enough for bundler comp due to there being
        // maxNumRefunds = 20.
        // 20 refunds equates to at least below gas tokens:
        //    gasPrice * (10 * refundGas) = 50 * (20 * 80k) = 80M
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT / 3,
                    3
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 20,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(teller)), PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!enough gas asset",
                assetsUnwrapped: false
            })
        );

        vm.prank(BOB);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = true, call[0] failed (too few gas tokens)
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].failureReason),
                "!enough gas asset"
            )
        );

        // No balances changed, bundler not compensated for missing this check
        assertEq(token.balanceOf(address(teller)), PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);
    }

    function testProcessBundleFailureOOG() public {
        // Alice starts with 2 * 50M tokens in teller
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation low executionGasLimit (not enough for transfer)
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: 100, // not enough gas for transfer
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        assertEq(token.balanceOf(address(teller)), 2 * PER_NOTE_AMOUNT);
        assertEq(token.balanceOf(address(BOB)), 0);

        // Check OperationProcessed event emits processed = false
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "exceeded `executionGasLimit`",
                assetsUnwrapped: true
            })
        );

        vm.prank(ALICE);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].failureReason, "exceeded `executionGasLimit`");

        // ALICE (bundler) was still paid
        assertLt(token.balanceOf(address(teller)), 2 * PER_NOTE_AMOUNT);
        assertGt(token.balanceOf(address(ALICE)), 0);
    }

    // TODO: move to Handler.t.sol
    function testHandleOperationNotTellerCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Attempt to call handleOperation directly with ALICE as caller not
        // teller
        vm.prank(ALICE);
        vm.expectRevert("Only teller");
        handler.handleOperation(op, 0, ALICE);
    }

    function testHandleOperationBadChainId() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Format op with BAD_CHAIN_ID failure type
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.BAD_CHAIN_ID
            })
        );

        vm.prank(address(teller));
        vm.expectRevert("invalid chainid");
        handler.handleOperation(op, 0, BUNDLER);
    }

    function testHandleOperationExpiredDeadline() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Format op with EXPIRED_DEADLINE failure type
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.EXPIRED_DEADLINE
            })
        );

        vm.prank(address(teller));
        vm.expectRevert("expired deadline");
        handler.handleOperation(op, 0, BUNDLER);
    }

    // TODO: move to Handler.t.sol
    function testExecuteActionsNotHandlerCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: handler.root(),
                joinSplitPublicSpends: NocturneUtils.fillJoinSplitPublicSpends(
                    PER_NOTE_AMOUNT,
                    1
                ),
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Attempt to call executeActions directly with ALICE as caller not
        // teller
        vm.prank(ALICE);
        vm.expectRevert("Only this");
        handler.executeActions(op);
    }
}
