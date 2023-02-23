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
import {ReentrantCaller} from "./utils/ReentrantCaller.sol";
import {TokenSwapper, SwapRequest} from "./utils/TokenSwapper.sol";
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
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        StealthAddress memory _depositAddr
    ) public {
        wallet.depositFunds(
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
                    recipient,
                    address(token),
                    remainder,
                    ERC20_ID,
                    addr
                );
            } else {
                depositFunds(
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

    function testDepositNotMsgSender() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        vm.prank(ALICE);
        token.approve(address(vault), PER_NOTE_AMOUNT);

        vm.prank(BOB); // prank with BOB not ALICE
        vm.expectRevert("Spender must be the sender");
        depositFunds(
            ALICE,
            address(token),
            PER_NOTE_AMOUNT,
            ERC20_ID,
            NocturneUtils.defaultStealthAddress()
        );
    }

    function testDummyTransferSingleJoinSplit() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
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
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
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
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 6,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    4 * PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
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

    function testProcessFailingOperationBadRoot() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with faulty root, will cause revert in
        // handleJoinSplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: 1 * PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.BAD_ROOT
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
        assertEq(opResults[0].failureReason, "Tree root not past root");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessFailingOperationAlreadyUsedNullifier() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.ALREADY_USED_NF
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
        assertEq(opResults[0].failureReason, "Nullifier B already used");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessFailingOperationMatchingNullifiers() public {
        // Alice starts with 2 * 50M in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.MATCHING_NFS
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
        assertEq(opResults[0].failureReason, "2 nfs should !equal");

        // No tokens are lost from vault because handleJoinSplit revert stops
        // bundler comp. Bundler expected to handle proof-related checks.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    function testProcessFailingActionReentrancyProcessBundle() public {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        ReentrantCaller reentrantCaller = new ReentrantCaller(
            wallet,
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
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](0);
        bytes[] memory callResults = new bytes[](0);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true, // op processed = true, as internal revert happened in action
            failureReason,
            callSuccesses,
            callResults
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "ReentrancyGuard: reentrant call"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGe(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessFailingActionReentrancyProcessOperationWalletCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when wallet calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Encode action for wallet to call itself processOperation
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(wallet),
            encodedFunction: abi.encodeWithSelector(
                wallet.processOperation.selector,
                internalOp
            )
        });

        // Nest internal op into action where wallet call itself via
        // processOperation
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](0);
        bytes[] memory callResults = new bytes[](0);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true, // op processed = true, as internal revert happened in action
            failureReason,
            callSuccesses,
            callResults
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Reentry into processOperation"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGe(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessFailingActionReentrancyExecuteActionsWalletCaller()
        public
    {
        // Alice starts with 2 * 50M tokens in vault
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create internal op that is used when wallet calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Encode action for wallet to call itself executeActions
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(wallet),
            encodedFunction: abi.encodeWithSelector(
                wallet.executeActions.selector,
                internalOp
            )
        });

        // Nest internal op into action where wallet call itself via
        // executeActions
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](0);
        bytes[] memory callResults = new bytes[](0);
        string memory failureReason;
        emit OperationProcessed(
            uint256(0),
            true, // op processed = true, as internal revert happened in action
            failureReason,
            callSuccesses,
            callResults
        );

        // Op was processed but call result has reentry failure message
        vm.prank(BOB);
        OperationResult[] memory opResults = wallet.processBundle(bundle);
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].callSuccesses.length, uint256(1));
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "Reentry into executeActions"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGe(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    // Test failing calls
    function testProcessFailingActionTransferNotEnoughFunds() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by wallet
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    3 * PER_NOTE_AMOUNT
                ), // Transfer amount exceeds withdrawn
                joinSplitsFailureType: JoinSplitsFailureType.NONE
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
        assert(
            ParseUtils.hasSubstring(
                string(opResults[0].callResults[0]),
                "transfer amount exceeds balance"
            )
        );

        // Alice lost some private balance due to bundler comp. Bob (acting as
        // bundler) has a little bit of tokens. Can't calculate exact amount
        // because verification uses mock verifiers + small amount of gas paid
        // out for failed transfer action.
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(2 * PER_NOTE_AMOUNT));
        assertEq(token.balanceOf(address(ALICE)), uint256(0));
        assertGe(token.balanceOf(address(BOB)), uint256(0)); // Bob gained funds
    }

    function testProcessOperationNotWalletCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Attempt to call processOperation directly without ALICE as caller not
        // wallet
        vm.prank(ALICE);
        vm.expectRevert("Only the Wallet can call this");
        wallet.processOperation(op, 0, ALICE);
    }

    function testExecuteActionsNotWalletCaller() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    token,
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Attempt to call executeActions directly without ALICE as caller not
        // wallet
        vm.prank(ALICE);
        vm.expectRevert("Only the Wallet can call this");
        wallet.executeActions(op);
    }

    function testProcessBundleSuccessfulErc20Refunds() public {
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

        // Call swapper.swap, asking for erc20 tokens back
        SimpleERC20Token tokenOut = ERC20s[1];
        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(wallet),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(tokenIn),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(tokenOut),
                    erc20OutAmount: PER_NOTE_AMOUNT,
                    erc721Out: address(0x0),
                    erc721OutId: 0,
                    erc1155Out: address(0x0),
                    erc1155OutId: 0,
                    erc1155OutAmount: 0
                })
            )
        });

        // Encode tokenOut as refund asset
        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(tokenOut),
            ERC20_ID
        );

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: tokenIn,
                root: wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 1,
                encodedRefundAssets: encodedRefundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: actions,
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in vault
        assertEq(tokenIn.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(tokenOut.balanceOf(address(vault)), uint256(0));
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(0));

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
        assertEq(opResults[0].callSuccesses.length, uint256(2));
        assertEq(opResults[0].callSuccesses[0], true);
        assertEq(opResults[0].callSuccesses[1], true);
        assertEq(opResults[0].callResults.length, uint256(2));

        // Ensure 50M tokensIn in swapper, 50M tokensOut in vault
        assertEq(tokenIn.balanceOf(address(vault)), uint256(0));
        assertEq(tokenOut.balanceOf(address(vault)), uint256(PER_NOTE_AMOUNT));
        assertEq(tokenIn.balanceOf(address(swapper)), uint256(PER_NOTE_AMOUNT));
    }
}
