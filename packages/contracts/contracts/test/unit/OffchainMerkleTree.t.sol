// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import {ParseUtils} from "../utils/ParseUtils.sol";
import {TreeUtils} from "../../libs/TreeUtils.sol";
import {TreeTest, TreeTestLib} from "../utils/TreeTest.sol";
import {LibOffchainMerkleTree, OffchainMerkleTree} from "../../libs/OffchainMerkleTree.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {ISubtreeUpdateVerifier} from "../../interfaces/ISubtreeUpdateVerifier.sol";
import {PoseidonHasherT3, PoseidonHasherT5, PoseidonHasherT6} from "../utils/PoseidonHashers.sol";
import {PoseidonDeployer} from "../utils/PoseidonDeployer.sol";
import {TestSubtreeUpdateVerifier} from "../harnesses/TestSubtreeUpdateVerifier.sol";
import "../../libs/Types.sol";

contract TestOffchainMerkleTree is PoseidonDeployer {
    using TreeTestLib for TreeTest;
    using LibOffchainMerkleTree for OffchainMerkleTree;

    OffchainMerkleTree merkle;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    IHasherT3 hasherT3;
    IHasherT5 hasherT5;
    IHasherT6 hasherT6;
    TreeTest treeTest;

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNote(EncodedNote note);

    uint256 constant DEPTH_TO_SUBTREE =
        TreeUtils.DEPTH - TreeUtils.BATCH_SUBTREE_DEPTH;

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();
        subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            new TestSubtreeUpdateVerifier()
        );
        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT5 = IHasherT5(new PoseidonHasherT5(poseidonT5));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));
        treeTest.initialize(hasherT3, hasherT5, hasherT6);
        merkle.initialize(address(subtreeUpdateVerifier));
    }

    function testTreeTest() public {
        // test that hashing empty batch gives EMPTY_SUBTREEgetRoot
        uint256[] memory batch = new uint256[](0);
        assertEq(
            treeTest.computeSubtreeRoot(batch),
            TreeTestLib.EMPTY_SUBTREE_ROOT
        );

        // test that hashing empty batch total gives EMPTY_TREE_ROOT
        uint256[][3] memory path = treeTest.computeInitialPaths(batch);
        assertEq(path[0][DEPTH_TO_SUBTREE], TreeUtils.EMPTY_TREE_ROOT);

        // test computeInitialPaths for non-empty batch
        batch = new uint256[](2);
        batch[0] = 420;
        batch[1] = 69;
        path = treeTest.computeInitialPaths(batch);
        assertEq(
            path[0][DEPTH_TO_SUBTREE],
            20866814482893391023708599274360368763430909867781488140108298202181069329272
        );
        assertEq(path[0][0], treeTest.computeSubtreeRoot(batch));

        // test computeNewPaths for non-empty batch
        batch = new uint256[](3);
        batch[0] = 9;
        batch[1] = 1;
        batch[2] = 1449;
        path = treeTest.computeNewPaths(batch, path, 16);
        assertEq(
            path[0][DEPTH_TO_SUBTREE],
            7680947723925673787986137209869767969751341331255234083739034113877308684849
        );
        assertEq(path[0][0], treeTest.computeSubtreeRoot(batch));
    }

    function testInsertSingleNote() public {
        uint256[] memory batch = new uint256[](2);
        // insert 1 note and 1 commitment
        EncodedNote[] memory notes = new EncodedNote[](1);
        notes[0] = dummyNote();
        batch[0] = treeTest.computeNoteCommitment(notes[0]);

        merkle.insertNotes(notes);
        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 1);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // apply subtree update
        // before applying update, offchain service needs to insert a bunch of stuff
        merkle._fillBatchWithZeros();

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // compute new root and call `applySubtreeUpdate`
        uint256[][3] memory path = treeTest.computeInitialPaths(batch);
        uint256 newRoot = path[0][DEPTH_TO_SUBTREE];
        merkle.applySubtreeUpdate(newRoot, dummyProof());

        assertEq(uint256(merkle.getCount()), 16);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), newRoot);
    }

    function testInsertMultipleCommitments() public {
        uint256[] memory batch = new uint256[](16);
        uint256[] memory ncs = new uint256[](16);
        for (uint256 i = 0; i < 16; i++) {
            ncs[i] = i;
            batch[i] = ncs[i];
        }

        merkle.insertNoteCommitments(ncs);

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // apply subtree update
        uint256[][3] memory path = treeTest.computeInitialPaths(batch);
        uint256 newRoot = path[0][DEPTH_TO_SUBTREE];
        merkle.applySubtreeUpdate(newRoot, dummyProof());

        assertEq(merkle.getCount(), 16);
        assertEq(merkle.getTotalCount(), 16);
        assertEq(merkle.getRoot(), newRoot);
    }

    function testCalculatePublicInputs() public {
        // Insert 1 note
        EncodedNote memory note = dummyNote();
        EncodedNote[] memory notes = new EncodedNote[](1);
        notes[0] = note;

        uint256 nc = treeTest.computeNoteCommitment(note);
        merkle.insertNotes(notes);

        // Insert 4 note

        notes = new EncodedNote[](4);
        for (uint256 i = 0; i < 4; i++) {
            notes[i] = note;
        }
        merkle.insertNotes(notes);

        // Insert 9 ncs
        uint256[] memory ncs = new uint256[](9);
        for (uint256 i = 0; i < 9; i++) {
            ncs[i] = nc;
        }
        merkle.insertNoteCommitments(ncs);

        // Insert 2 note
        notes = new EncodedNote[](2);
        for (uint256 i = 0; i < 2; i++) {
            notes[i] = note;
        }
        merkle.insertNotes(notes);

        uint256[] memory batch = new uint256[](16);
        for (uint256 i = 0; i < 16; i++) {
            batch[i] = nc;
        }

        uint256[][3] memory path = treeTest.computeInitialPaths(batch);
        uint256 _newRoot = path[0][DEPTH_TO_SUBTREE];

        uint256 newRoot = 17851036531648172315007085202360506341175596362706882083251817558375094796263;

        assertEq(newRoot, _newRoot);

        uint256 accumulatorHash = merkle.getAccumulatorHash();
        console.log("accumulatorHash", accumulatorHash);
        (uint256 hi, ) = TreeUtils.uint256ToFieldElemLimbs(accumulatorHash);

        console.log("accumulatorHashHi", hi);

        uint256[] memory pis = merkle._calculatePublicInputs(newRoot);
        assertEq(pis[0], TreeUtils.EMPTY_TREE_ROOT);
        assertEq(pis[1], newRoot);
        assertEq(pis[2], 1879048192);
        assertEq(
            pis[3],
            13761535849878919798310125019909519451162264697046676736248712268787268459921
        );
    }

    function dummyProof() internal pure returns (uint256[8] memory) {
        uint256[8] memory res;
        return res;
    }

    function dummyNote() internal pure returns (EncodedNote memory) {
        EncodedNote memory note = EncodedNote({
            ownerH1: 20053872845712750666020333248434368879858874000328815279916175647306793909806,
            ownerH2: 10878178814994881930842668029692572520203302021151403528591159382456948662398,
            nonce: 1,
            encodedAssetAddr: 917551056842671309452305380979543736893630245704,
            encodedAssetId: 5,
            value: 100
        });

        return note;
    }
}
