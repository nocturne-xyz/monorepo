// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IJoinSplitVerifier} from "../interfaces/IJoinSplitVerifier.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import "./utils/NocturneUtils.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";
import {Utils} from "../libs/Utils.sol";
import {AssetUtils} from "../libs/AssetUtils.sol";
import "../libs/Types.sol";

contract WalletTest is Test, ParseUtils, PoseidonDeployer {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    Wallet wallet;
    Vault vault;
    TreeTest treeTest;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

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

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        // Instantiate vault, joinSplitVerifier, tree, and wallet
        vault = new Vault();
        joinSplitVerifier = new TestJoinSplitVerifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        wallet = new Wallet();
        wallet.initialize(
            address(vault),
            address(joinSplitVerifier),
            address(subtreeUpdateVerifier)
        );

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT3, hasherT6);

        vault.initialize(address(wallet));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
        }
    }

    function depositFunds(
        Wallet _wallet,
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        StealthAddress memory _depositAddr
    ) public {
        _wallet.depositFunds(
            Deposit({
                spender: _spender,
                encodedAssetAddr: uint256(uint160(_asset)),
                encodedAssetId: _id,
                value: _value,
                depositAddr: _depositAddr
            })
        );
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        vm.prank(recipient);
        token.approve(address(vault), amount);

        uint256[] memory batch = new uint256[](16);

        uint256 remainder = amount % PER_NOTE_AMOUNT;
        uint256 depositIterations = remainder == 0
            ? amount / PER_NOTE_AMOUNT
            : amount / PER_NOTE_AMOUNT + 1;

        // Deposit funds to vault
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

            vm.prank(recipient);
            if (i == depositIterations - 1 && remainder != 0) {
                depositFunds(
                    wallet,
                    recipient,
                    address(token),
                    remainder,
                    ERC20_ID,
                    addr
                );
            } else {
                depositFunds(
                    wallet,
                    recipient,
                    address(token),
                    PER_NOTE_AMOUNT,
                    ERC20_ID,
                    addr
                );
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

        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 root = path[path.length - 1];

        // fill the tree batch
        wallet.fillBatchWithZeros();

        wallet.applySubtreeUpdate(root, NocturneUtils.dummyProof());
    }

    function testDummyTransferSingleJoinSplit() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: PER_NOTE_AMOUNT,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check joinsplit event
        vm.expectEmit(true, true, false, true);
        emit JoinSplitProcessed(
            bundle.operations[0].joinSplits[0].nullifierA,
            bundle.operations[0].joinSplits[0].nullifierB,
            16, // newNoteAIndex
            17, // newNoteBIndex
            bundle.operations[0].joinSplits[0]
        );

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = true;
        bytes[] memory callResults = new bytes[](1);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true,
            failureReason,
            callSuccesses,
            callResults
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Ensure 50M left vault to BOB, 50M left in vault
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(PER_NOTE_AMOUNT));
    }

    function testDummyTransferThreeJoinSplit() public {
        // Alice starts with 3 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 3 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: PER_NOTE_AMOUNT,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(3 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = true;
        bytes[] memory callResults = new bytes[](1);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true,
            failureReason,
            callSuccesses,
            callResults
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Ensure 50M left vault, 2 * 50M remains
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(PER_NOTE_AMOUNT));
    }

    function testDummyTransferSixJoinSplit() public {
        // Alice starts with 6 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 6 * PER_NOTE_AMOUNT);

        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: 4 * PER_NOTE_AMOUNT,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 6,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(6 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = true;
        bytes[] memory callResults = new bytes[](1);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true,
            failureReason,
            callSuccesses,
            callResults
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Ensure 4 * 50M left vault, 2 * 50M remains
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(4 * PER_NOTE_AMOUNT));
    }

    // Ill-formatted operation should not be processed
    function testProcessesFailingOperation() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with faulty root, will cause revert in
        // handleJoinSplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: PER_NOTE_AMOUNT,
                root: uint256(0x1234), // garbage root, fails handleJoinSplit
                publicSpendPerJoinSplit: 1 * PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](0);
        bytes[] memory callResults = new bytes[](0);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            false,
            failureReason,
            callSuccesses,
            callResults
        );

        OperationResult[] memory opResults = wallet.processBundle(bundle);

        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].callSuccesses.length, uint256(0));
        assertEq(opResults[0].callResults.length, uint256(0));

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    // Test failing calls
    function testProcessesFailingAction() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by wallet
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: 3 * PER_NOTE_AMOUNT, // Transfer amount exceeds withdrawn
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50
            })
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = false;
        bytes[] memory callResults = new bytes[](1);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true,
            failureReason,
            callSuccesses,
            callResults
        );

        // Use Bob as bundler for this call
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);

        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGe(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }
}
