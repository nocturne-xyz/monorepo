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
import {TokenSwapper, SwapRequest, Erc721TransferFromRequest, Erc721And1155SafeTransferFromRequest} from "../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../utils/TreeTest.sol";
import "../utils/NocturneUtils.sol";
import "../utils/ForgeUtils.sol";
import {Teller} from "../../Teller.sol";
import {Handler} from "../../Handler.sol";
import {CommitmentTreeManager} from "../../CommitmentTreeManager.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../tokens/SimpleERC1155Token.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Utils} from "../../libs/Utils.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";
import "../../libs/Types.sol";

contract TellerAndHandlerTest is Test, ForgeUtils, PoseidonDeployer {
    using LibOffchainMerkleTree for OffchainMerkleTree;
    uint256 public constant BN254_SCALAR_FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    // Check storage layout file
    uint256 constant OPERATION_STAGE_STORAGE_SLOT = 278;
    uint256 constant ENTERED_EXECUTE_ACTIONS = 3;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant BUNDLER = address(3);
    address constant DEPOSIT_SOURCE = address(3);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    Teller teller;
    Handler handler;
    TreeTest treeTest;
    SimpleERC20Token[3] ERC20s;
    IHasherT5 hasherT5;
    IHasherT6 hasherT6;

    event DepositSourcePermissionSet(address source, bool permission);

    event SubtreeBatchFillerPermissionSet(address filler, bool permission);

    event RefundProcessed(
        CompressedStealthAddress refundAddr,
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

        hasherT5 = IHasherT5(new PoseidonHasherT5(poseidonT5));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT5, hasherT6);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();

            // Prefill the handler with 1 token
            ERC20s[i].reserveTokens(address(handler), 1);

            handler.setContractPermission(address(ERC20s[i]), true);
            handler.setContractMethodPermission(
                address(ERC20s[i]),
                ERC20s[i].approve.selector,
                true
            );
            handler.setContractMethodPermission(
                address(ERC20s[i]),
                ERC20s[i].transfer.selector,
                true
            );
        }
    }

    function depositFunds(
        address spender,
        SimpleERC20Token token,
        uint256 value,
        uint256 id,
        CompressedStealthAddress memory depositAddr
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
            CompressedStealthAddress memory addr = NocturneUtils
                .defaultStealthAddress();
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
                addr.h1,
                addr.h2,
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
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation to transfer 25M tokens to bob of 50M note
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 1,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation to transfer 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            3
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            6
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation with faulty root, will cause revert in
        // handleJoinSplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
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
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                maybeFailureReason: "Nullifier A already used",
                assetsUnwrapped: false
            })
        );

        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assertEq(opResults[0].failureReason, "Nullifier A already used");

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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation with one of the joinsplits has matching NFs A and B
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
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
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
            address(ERC20s[0])
        );

        // Encode action that calls reentrant contract
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(reentrantCaller),
            encodedFunction: abi.encodeWithSelector(
                reentrantCaller.reentrantProcessBundle.selector
            )
        });

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
        handler.setContractPermission(address(reentrantCaller), true);
        handler.setContractMethodPermission(
            address(reentrantCaller),
            reentrantCaller.reentrantProcessBundle.selector,
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create internal op that is used when handler calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create internal op that is used when teller calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
        handler.setContractPermission(address(handler), true);
        handler.setContractMethodPermission(
            address(handler),
            handler.handleOperation.selector,
            true
        );

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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create internal op that is used when handler calls itself
        Operation memory internalOp = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
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
        handler.setContractPermission(address(handler), true);
        handler.setContractMethodPermission(
            address(handler),
            handler.executeActions.selector,
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by teller
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
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
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create transaction to send 3 * 50M even though only 2 * 50M is being
        // taken up by teller
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
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
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
        SimpleERC20Token erc20In = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20In, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(erc20In),
            encodedFunction: abi.encodeWithSelector(
                erc20In.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(erc20In),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20In and erc20Out as refund assets
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(erc20Out),
                ERC20_ID
            ),
            minRefundValue: 0
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20In)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20In),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1));
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));

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

    function testProcessBundleFailsNotEnoughRefundReturnTokens() public {
        SimpleERC20Token erc20In = ERC20s[0];
        SimpleERC20Token erc20Out = ERC20s[1];

        reserveAndDepositFunds(ALICE, erc20In, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();
        handler.setContractPermission(address(swapper), true);
        handler.setContractMethodPermission(
            address(swapper),
            swapper.swap.selector,
            true
        );

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(erc20In),
            encodedFunction: abi.encodeWithSelector(
                erc20In.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20 tokens back
        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(erc20In),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT // PER_NOTE_AMOUNT in out tokens
                })
            )
        });

        // Specify refund amount 1 greater than what we get back
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(erc20Out),
                ERC20_ID
            ),
            minRefundValue: PER_NOTE_AMOUNT + 1 // 1 more token than we actually get back
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20In)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20In),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 10,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1));
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!min refund value",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);

        // Bundler was compensated, swapper never received any tokens, nor did teller
        assertLt(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertGt(erc20In.balanceOf(BUNDLER), 0);
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));
        assertEq(erc20Out.balanceOf(address(teller)), uint256(0));
    }

    function testProcessBundleFailsNotEnoughJoinSplitReturnTokens() public {
        SimpleERC20Token erc20In = ERC20s[0];
        SimpleERC20Token erc20Out = ERC20s[1];

        reserveAndDepositFunds(ALICE, erc20In, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();
        handler.setContractPermission(address(swapper), true);
        handler.setContractMethodPermission(
            address(swapper),
            swapper.swap.selector,
            true
        );

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(erc20In),
            encodedFunction: abi.encodeWithSelector(
                erc20In.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20 tokens back
        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(erc20In),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT / 2, // only give 1/2 of in tokens
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT // give PER_NOTE_AMOUNT back
                })
            )
        });

        // Specify expected refund amount
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(erc20Out),
                ERC20_ID
            ),
            minRefundValue: PER_NOTE_AMOUNT // matches what swapper gives us
        });

        // Specify more joinsplit tokens to return than we get
        uint256[] memory joinSplitReturnAmounts = new uint256[](1);
        joinSplitReturnAmounts[0] = (PER_NOTE_AMOUNT / 2) + 1; // 1 more than we get back

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20In)
                ),
                joinSplitRefundValues: joinSplitReturnAmounts,
                gasToken: address(erc20In),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 10,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1));
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!min refund value",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed = false
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);

        // Bundler was compensated, swapper never received any tokens, nor did teller
        assertLt(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertGt(erc20In.balanceOf(BUNDLER), 0);
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));
        assertEq(erc20Out.balanceOf(address(teller)), uint256(0));
    }

    function testProcessBundleSuccessfulAllRefunds() public {
        SimpleERC20Token erc20In = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20In, PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](2);

        // Approve swapper to transfer tokens
        actions[0] = Action({
            contractAddress: address(erc20In),
            encodedFunction: abi.encodeWithSelector(
                erc20In.approve.selector,
                address(swapper),
                PER_NOTE_AMOUNT
            )
        });

        // Call swapper.swap, asking for erc20 tokens back
        SimpleERC20Token erc20Out = ERC20s[1];

        actions[1] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.swap.selector,
                SwapRequest({
                    assetInOwner: address(handler),
                    encodedAssetIn: AssetUtils.encodeAsset(
                        AssetType.ERC20,
                        address(erc20In),
                        ERC20_ID
                    ),
                    assetInAmount: PER_NOTE_AMOUNT,
                    erc20Out: address(erc20Out),
                    erc20OutAmount: PER_NOTE_AMOUNT
                })
            )
        });

        // Encode erc20In and erc20Out as refund assets
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(erc20Out),
                ERC20_ID
            ),
            minRefundValue: 0
        });
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20In)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20In),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: actions,
                atomicActions: false,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 50M tokensIn in teller and nothing else, swapper has 0 erc20In tokens
        assertEq(erc20In.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20Out.balanceOf(address(handler)), uint256(1)); // +1 from prefill
        assertEq(erc20In.balanceOf(address(swapper)), uint256(0));

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist token swapper for sake of simulation
        handler.setContractPermission(address(swapper), true);
        handler.setContractMethodPermission(
            address(swapper),
            swapper.swap.selector,
            true
        );

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
        assertEq(erc20In.balanceOf(address(handler)), uint256(1));
        assertEq(erc20Out.balanceOf(address(teller)), uint256(PER_NOTE_AMOUNT));
        assertEq(erc20In.balanceOf(address(swapper)), uint256(PER_NOTE_AMOUNT));
    }

    function testProcessBundleUnspecifiedTokensNoRefunds() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        reserveAndDepositFunds(ALICE, joinSplitToken, 2 * PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](1);

        SimpleERC721Token erc721 = new SimpleERC721Token();

        actions[0] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.transferFromErc721.selector,
                Erc721TransferFromRequest({
                    erc721Out: address(erc721),
                    erc721OutId: 1
                })
            )
        });

        // No refund assets
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(joinSplitToken)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(joinSplitToken),
                root: handler.root(),
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
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 100M joinSplitToken in teller and nothing else
        assertEq(
            joinSplitToken.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(erc721.balanceOf(address(handler)), uint256(0));

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "",
                assetsUnwrapped: true
            })
        );

        // Whitelist token swapper for sake of simulation
        handler.setContractMethodPermission(
            address(swapper),
            swapper.transferFromErc721.selector,
            true
        );

        // Get total leaf count before bundle
        uint256 totalCount = handler.totalCount();

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, processed, assets unwrapped
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, true);
        assertEq(opResults[0].assetsUnwrapped, true);

        // Teller lost some joinSplitToken to BUNDLER due to bundler gas fee
        assertLt(
            joinSplitToken.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertGt(joinSplitToken.balanceOf(BUNDLER), 0);

        // Tokens are stuck in handler, no refunds for stuck tokens
        assertEq(erc721.balanceOf(address(handler)), uint256(1));
        assertEq(totalCount + 5, handler.totalCount()); // 4 notes for 2 JSs, 1 refund for unwrapped erc20s, no erc721
    }

    function testProcessBundleRejectsActionsWithUnsupportedMethods() public {
        SimpleERC20Token erc20 = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20, PER_NOTE_AMOUNT);

        erc20.reserveTokens(ALICE, PER_NOTE_AMOUNT);
        vm.prank(ALICE);
        erc20.approve(address(handler), PER_NOTE_AMOUNT);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(erc20),
            encodedFunction: abi.encodeWithSelector(
                erc20.transferFrom.selector,
                address(handler),
                PER_NOTE_AMOUNT
            )
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "Cannot call non-allowed protocol method",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, no assets unwrapped
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(
            opResults[0].failureReason,
            "Cannot call non-allowed protocol method"
        );

        assertGt(erc20.balanceOf(BUNDLER), 0);
        assertLt(erc20.balanceOf(address(teller)), PER_NOTE_AMOUNT);
        assertEq(erc20.balanceOf(address(ALICE)), PER_NOTE_AMOUNT);
    }

    function testProcessBundleFailsDueToErc20ApproveOnBadSpender() public {
        SimpleERC20Token erc20 = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20, PER_NOTE_AMOUNT);

        address NOT_ALLOWED_CONTRACT = address(0x4444);

        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: address(erc20),
            encodedFunction: abi.encodeWithSelector(
                erc20.approve.selector,
                address(NOT_ALLOWED_CONTRACT),
                PER_NOTE_AMOUNT
            )
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!approve spender",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, failure reason for approve check failure
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].failureReason, "!approve spender");

        assertEq(erc20.allowance(address(handler), NOT_ALLOWED_CONTRACT), 0);
    }

    function testProcessBundleFailsErc20FunctionSelectorClashWithInvalidSpender()
        public
    {
        SimpleERC20Token erc20 = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20, PER_NOTE_AMOUNT);

        // Approve other contract which is meant to be allowed contract that has fn selector clash
        // with erc20.approve
        address CONTRACT_WITH_SELECTOR_CLASH = address(0x4444);
        handler.setContractPermission(CONTRACT_WITH_SELECTOR_CLASH, true);
        handler.setContractMethodPermission(
            CONTRACT_WITH_SELECTOR_CLASH,
            erc20.approve.selector,
            true
        );

        // Format action that is correct encoded fn selector and length as erc20.approve but field
        // gets abi.decoded into invalid spender
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: CONTRACT_WITH_SELECTOR_CLASH,
            encodedFunction: abi.encodePacked(
                handler.ERC20_APPROVE_SELECTOR(),
                bytes32(uint256(0x123456789)),
                bytes32(uint256(0x123456789))
            )
        });

        // Set clashing selector contract code to be non-zero to avoid "!zero code" revert
        vm.etch(CONTRACT_WITH_SELECTOR_CLASH, bytes("something"));

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!approve spender",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, failure reason for approve check failure
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].failureReason, "!approve spender");
    }

    function testProcessBundleFailsErc20FunctionSelectorClashWithInvalidFnDataLength()
        public
    {
        SimpleERC20Token erc20 = ERC20s[0];
        reserveAndDepositFunds(ALICE, erc20, PER_NOTE_AMOUNT);

        // Approve other contract which is meant to be allowed contract that has fn selector clash
        // with erc20.approve
        address CONTRACT_WITH_SELECTOR_CLASH = address(0x4444);
        handler.setContractPermission(CONTRACT_WITH_SELECTOR_CLASH, true);
        handler.setContractMethodPermission(
            CONTRACT_WITH_SELECTOR_CLASH,
            erc20.approve.selector,
            true
        );

        // Format action with correct encoded fn selector but total length incorrect (not 68 bytes)
        Action[] memory actions = new Action[](1);
        actions[0] = Action({
            contractAddress: CONTRACT_WITH_SELECTOR_CLASH,
            encodedFunction: abi.encodePacked(
                handler.ERC20_APPROVE_SELECTOR(),
                bytes32(uint256(0x123456789))
            )
        });

        // Set clashing selector contract code to be non-zero to avoid "!zero code" revert
        vm.etch(CONTRACT_WITH_SELECTOR_CLASH, bytes("something"));

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(erc20)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(erc20),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: new TrackedAsset[](0),
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!approve fn length",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, failure reason for approve check failure
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].failureReason, "!approve fn length");
    }

    function testProcessBundleUnsupportedRefundTokenNoRefunds() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        reserveAndDepositFunds(ALICE, joinSplitToken, 2 * PER_NOTE_AMOUNT);

        TokenSwapper swapper = new TokenSwapper();

        Action[] memory actions = new Action[](1);

        SimpleERC721Token erc721 = new SimpleERC721Token();

        actions[0] = Action({
            contractAddress: address(swapper),
            encodedFunction: abi.encodeWithSelector(
                swapper.transferFromErc721.selector,
                Erc721TransferFromRequest({
                    erc721Out: address(erc721),
                    erc721OutId: 1
                })
            )
        });

        // Encode erc721 as refund asset
        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](1);
        trackedRefundAssets[0] = TrackedAsset({
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC721,
                address(erc721),
                1
            ),
            minRefundValue: 0
        });

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(joinSplitToken)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(joinSplitToken),
                root: handler.root(),
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
                actions: actions,
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        // Ensure 100M joinSplitToken in teller and nothing else
        assertEq(
            joinSplitToken.balanceOf(address(teller)),
            uint256(2 * PER_NOTE_AMOUNT)
        );
        assertEq(erc721.balanceOf(address(handler)), uint256(0));

        // Check OperationProcessed event
        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!supported refund asset",
                assetsUnwrapped: false
            })
        );

        // Whitelist token swapper for sake of simulation
        handler.setContractMethodPermission(
            address(swapper),
            swapper.swap.selector,
            true
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, no assets unwrapped
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, false);
        assertEq(opResults[0].failureReason, "!supported refund asset");

        // Bundler not compensated because it should have checked refund token was supported
        assertEq(joinSplitToken.balanceOf(BUNDLER), 0);

        // No tokens received
        assertEq(erc721.balanceOf(address(teller)), uint256(0));
        assertEq(erc721.balanceOf(address(handler)), uint256(0));
    }

    function testProcessBundleFailureNotEnoughBundlerComp() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Unwrap 50M, not enough for bundler comp due to there being
        // 20 joinsplits.
        // 20 joinsplits handles (no proof verification) equates to at least below gas tokens:
        //    gasPrice * (3 * joinSplitGas) = 300 * (3 * 80k) = 72M
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
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
                gasPrice: 300, // set unusually high gas price
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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
                maybeFailureReason: "Too few gas tokens",
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
                "Too few gas tokens"
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Create operation low executionGasLimit (not enough for transfer)
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: 100, // not enough gas for transfer
                gasPrice: 50,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

    function testHandleOperationExpiredDeadline() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        // Format op with EXPIRED_DEADLINE failure type
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(token),
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

    function testProcessBundleFailsCallingContractWithZeroCode() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 2 * PER_NOTE_AMOUNT);

        TrackedAsset[] memory trackedRefundAssets = new TrackedAsset[](0);

        address ZERO_CODE_CONTRACT = address(0xabcd);
        assertEq(ZERO_CODE_CONTRACT.code.length, 0);

        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitTokens: NocturneUtils._joinSplitTokensArrayOfOneToken(
                    address(token)
                ),
                joinSplitRefundValues: new uint256[](1),
                gasToken: address(token),
                root: handler.root(),
                joinSplitsPublicSpends: NocturneUtils
                    ._publicSpendsArrayOfOnePublicSpendArray(
                        NocturneUtils.fillJoinSplitPublicSpends(
                            PER_NOTE_AMOUNT,
                            1
                        )
                    ),
                trackedRefundAssets: trackedRefundAssets,
                gasAssetRefundThreshold: 0,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 0,
                actions: NocturneUtils.formatSingleTransferActionArray(
                    address(ZERO_CODE_CONTRACT),
                    BOB,
                    PER_NOTE_AMOUNT
                ),
                atomicActions: true,
                operationFailureType: OperationFailureType.NONE
            })
        );

        vmExpectOperationProcessed(
            ExpectOperationProcessedArgs({
                maybeFailureReason: "!zero code",
                assetsUnwrapped: true
            })
        );

        vm.prank(BUNDLER);
        OperationResult[] memory opResults = teller.processBundle(bundle);

        // One op, not processed, failure reason zero code
        assertEq(opResults.length, uint256(1));
        assertEq(opResults[0].opProcessed, false);
        assertEq(opResults[0].assetsUnwrapped, true);
        assertEq(opResults[0].failureReason, "!zero code");
    }

    // TODO: add testcase for leftover tokens in handler sent to leftover holder
}
