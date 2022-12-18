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
import {TestJoinSplitVerifier} from "./utils/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {Utils} from "../libs/Utils.sol";
import "../libs/types.sol";

contract DummyWalletTest is Test, TestUtils, PoseidonDeployer {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    uint256 constant DEFAULT_GAS_LIMIT = 1000000;
    uint256 constant ERC20_ID = 1;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    uint256 constant PER_DEPOSIT_AMOUNT = uint256(1000000);

    Wallet wallet;
    Vault vault;
    TreeTest treeTest;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

    event Refund(
        NocturneAddress refundAddr,
        uint256 nonce,
        uint256 encodedAddr,
        uint256 encodedId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplit(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplitTransaction joinSplitTx
    );

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        bytes failureReason,
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

        wallet = new Wallet(
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

    function defaultNocturneAddress()
        internal
        pure
        returns (NocturneAddress memory)
    {
        return
            NocturneAddress({
                h1X: 1938477,
                h1Y: 9104058,
                h2X: 1032988,
                h2Y: 1032988
            });
    }

    function dummyProof() internal pure returns (uint256[8] memory _values) {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function depositFunds(
        Wallet _wallet,
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        NocturneAddress memory _depositAddr
    ) public {
        _wallet.depositFunds(
            Deposit({
                spender: _spender,
                encodedAddr: uint256(uint160(_asset)),
                encodedId: _id,
                value: _value,
                depositAddr: _depositAddr
            })
        );
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 reserveAmount,
        uint256 depositAmount
    ) internal {
        token.reserveTokens(recipient, reserveAmount);

        vm.prank(recipient);
        token.approve(address(vault), depositAmount);

        uint256[] memory batch = new uint256[](16);

        uint256 remainder = depositAmount % PER_DEPOSIT_AMOUNT;
        uint256 depositIterations = remainder == 0
            ? depositAmount / PER_DEPOSIT_AMOUNT
            : depositAmount / PER_DEPOSIT_AMOUNT + 1;

        // Deposit funds to vault
        for (uint256 i = 0; i < depositIterations; i++) {
            NocturneAddress memory addr = defaultNocturneAddress();
            vm.expectEmit(true, true, true, true);
            emit Refund(
                addr,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                PER_DEPOSIT_AMOUNT,
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
                    PER_DEPOSIT_AMOUNT,
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

        wallet.applySubtreeUpdate(root, dummyProof());
    }

    function formatTransferOperation(
        SimpleERC20Token token,
        address recipient,
        uint256 amount,
        uint256 publicSpend,
        uint256 gasLimit,
        uint256 gasPrice
    ) internal view returns (Operation memory) {
        Action memory transferAction = Action({
            contractAddress: address(token),
            encodedFunction: abi.encodeWithSelector(
                token.transfer.selector,
                recipient,
                amount
            )
        });

        uint256 root = wallet.root();
        NoteTransmission memory newNoteATransmission = NoteTransmission({
            owner: NocturneAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });
        NoteTransmission memory newNoteBTransmission = NoteTransmission({
            owner: NocturneAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });

        EncodedAsset memory encodedAsset = EncodedAsset({
            encodedAddr: uint256(uint160(address(token))),
            encodedId: uint256(0)
        });
        JoinSplitTransaction memory joinSplitTx = JoinSplitTransaction({
            commitmentTreeRoot: root,
            nullifierA: uint256(182),
            nullifierB: uint256(183),
            newNoteACommitment: uint256(1038),
            newNoteATransmission: newNoteATransmission,
            newNoteBCommitment: uint256(1032),
            newNoteBTransmission: newNoteBTransmission,
            proof: dummyProof(),
            encodedAddr: encodedAsset.encodedAddr,
            encodedId: encodedAsset.encodedId,
            publicSpend: publicSpend
        });

        EncodedAsset[] memory encodedRefundAssets = new EncodedAsset[](1);
        encodedRefundAssets[0] = encodedAsset;

        JoinSplitTransaction[] memory joinSplitTxs = new JoinSplitTransaction[](
            1
        );
        joinSplitTxs[0] = joinSplitTx;
        Action[] memory actions = new Action[](1);
        actions[0] = transferAction;
        Operation memory op = Operation({
            joinSplitTxs: joinSplitTxs,
            refundAddr: defaultNocturneAddress(),
            encodedRefundAssets: encodedRefundAssets,
            actions: actions,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            maxNumRefunds: 1
        });

        return op;
    }

    function testPoseidon() public {
        console.log(
            new PoseidonHasherT3(poseidonT3).hash([uint256(0), uint256(1)])
        );
        console.log(
            new PoseidonHasherT4(poseidonT4).hash(
                [uint256(0), uint256(1), uint256(2)]
            )
        );
        console.log(
            new PoseidonHasherT5(poseidonT5).hash(
                [uint256(0), uint256(1), uint256(2), uint256(3)]
            )
        );
        console.log(
            new PoseidonHasherT6(poseidonT6).hash(
                [uint256(0), uint256(1), uint256(2), uint256(3), uint256(4)]
            )
        );
    }

    function testDummyTransfer() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 10 * 1000000, 8 * 1000000);

        // Create operation to transfer 50 tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = formatTransferOperation(
            token,
            BOB,
            1 * 1000000,
            2 * 1000000,
            1000000,
            0
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(8 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check joinsplit event
        vm.expectEmit(true, true, false, true);
        emit JoinSplit(
            bundle.operations[0].joinSplitTxs[0].nullifierA,
            bundle.operations[0].joinSplitTxs[0].nullifierB,
            16, // newNoteAIndex
            17, // newNoteBIndex
            bundle.operations[0].joinSplitTxs[0]
        );

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = true;
        bytes[] memory callResults = new bytes[](1);
        bytes memory failureReason;
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

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(7 * 1000000));
        assertGe(token.balanceOf(address(vault)), uint256(6 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(1 * 1000000));
    }

    // Ill-formatted operation should not be processed
    function testProcessesFailingOperation() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 10 * 1000000, 8 * 1000000);

        // Create transaction to withdraw 1500 tokens and send to Bob (more than
        // alice has)
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = formatTransferOperation(
            token,
            BOB,
            1 * 1000000,
            2 * 1000000,
            10000, // low gas limit
            1
        );

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(8 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](0);
        bytes[] memory callResults = new bytes[](0);
        bytes memory failureReason;
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

        // Balances should not have changed
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(8 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }

    // Test failing calls
    function testProcessesFailingAction() public {
        SimpleERC20Token token = ERC20s[0];
        reserveAndDepositFunds(ALICE, token, 10 * 1000000, 8 * 1000000);

        // Create transaction to withdraw 1500 tokens and send to Bob (more than
        // alice has)
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = formatTransferOperation(
            token,
            BOB,
            15 * 1000000,
            2 * 1000000,
            1000000,
            1
        );

        // Ensure balance remain same after call
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(8 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        // Check OperationProcessed event
        vm.expectEmit(false, true, false, false);
        bool[] memory callSuccesses = new bool[](1);
        callSuccesses[0] = false;
        bytes[] memory callResults = new bytes[](1);
        bytes memory failureReason;
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
        assertEq(opResults[0].callSuccesses[0], false);
        assertEq(opResults[0].callResults.length, uint256(1));

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertLe(token.balanceOf(address(vault)), uint256(8 * 1000000));
        assertGe(token.balanceOf(address(vault)), uint256(7 * 1000000));
        assertEq(token.balanceOf(address(ALICE)), uint256(2 * 1000000));
        assertEq(token.balanceOf(address(BOB)), uint256(0));
    }
}
