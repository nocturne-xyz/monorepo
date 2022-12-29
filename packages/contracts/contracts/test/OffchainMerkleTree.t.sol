// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {TreeUtils} from "../libs/TreeUtils.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {IHasherT3, IHasherT6} from "../interfaces/IHasher.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {PoseidonHasherT3, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";
import "../libs/types.sol";

contract TestOffchainMerkleTree is Test, TestUtils, PoseidonDeployer {
    using TreeTestLib for TreeTest;
    using OffchainMerkleTree for OffchainMerkleTreeData;

    OffchainMerkleTreeData merkle;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;
    TreeTest treeTest;

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(EncodedNote[] notes);

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();
        subtreeUpdateVerifier = ISubtreeUpdateVerifier(
            new TestSubtreeUpdateVerifier()
        );
        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));
        treeTest.initialize(hasherT3, hasherT6);
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
        uint256[] memory path = treeTest.computeInitialRoot(batch);
        assertEq(path[path.length - 1], TreeUtils.EMPTY_TREE_ROOT);

        // test computeInitialRoot for non-empty batch
        batch = new uint256[](2);
        batch[0] = 420;
        batch[1] = 69;
        path = treeTest.computeInitialRoot(batch);
        assertEq(
            path[path.length - 1],
            7535458605132084619456785809582285707117893595742786994560375527566624811343
        );
        assertEq(path[0], treeTest.computeSubtreeRoot(batch));

        // test computeNewRoot for non-empty batch
        batch = new uint256[](3);
        batch[0] = 9;
        batch[1] = 1;
        batch[2] = 1449;
        path = treeTest.computeNewRoot(batch, path, 16);
        assertEq(
            path[path.length - 1],
            6984220783167935932287489881196784031196766582157979071264100186030762206286
        );
        assertEq(path[0], treeTest.computeSubtreeRoot(batch));
    }

    function testInsertSingle() public {
        uint256[] memory batch = new uint256[](2);
        // insert 1 note and 1 commitment
        EncodedNote[] memory notes = new EncodedNote[](1);
        notes[0] = dummyNote();
        batch[0] = treeTest.computeNoteCommitment(notes[0]);

        merkle.insertNote(notes[0]);
        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 1);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        uint256[] memory ncs = new uint256[](1);
        ncs[0] = 2;
        batch[1] = ncs[0];

        merkle.insertNoteCommitment(ncs[0]);

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 2);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // apply subtree update
        // before applying update, offchain service needs to insert a bunch of stuff
        uint256[] memory zeros = new uint256[](14);
        merkle.insertNoteCommitments(zeros);

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // compute new root and call `applySubtreeUpdate`
        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 newRoot = path[path.length - 1];
        merkle.applySubtreeUpdate(newRoot, dummyProof());

        assertEq(uint256(merkle.getCount()), 16);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), newRoot);
    }

    function testInsertMultiple() public {
        // insert 5 notes and 11 commitments
        uint256[] memory batch = new uint256[](16);
        EncodedNote[] memory notes = new EncodedNote[](5);
        for (uint256 i = 0; i < 5; i++) {
            notes[i] = dummyNote();
            batch[i] = treeTest.computeNoteCommitment(notes[i]);
        }

        merkle.insertNotes(notes);

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 5);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        uint256[] memory ncs = new uint256[](11);
        for (uint256 i = 0; i < 11; i++) {
            ncs[i] = i;
            batch[i + 5] = ncs[i];
        }

        merkle.insertNoteCommitments(ncs);

        assertEq(uint256(merkle.getCount()), 0);
        assertEq(uint256(merkle.getTotalCount()), 16);
        assertEq(merkle.getRoot(), TreeUtils.EMPTY_TREE_ROOT);

        // apply subtree update
        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 newRoot = path[path.length - 1];
        merkle.applySubtreeUpdate(newRoot, dummyProof());

        assertEq(merkle.getCount(), 16);
        assertEq(merkle.getTotalCount(), 16);
        assertEq(merkle.getRoot(), newRoot);
    }

    function testCalculatePublicInputs() public {
        EncodedNote memory note = dummyNote();
        uint256 nc = treeTest.computeNoteCommitment(note);
        merkle.insertNote(note);
        merkle.insertNoteCommitment(nc);

        for (uint256 i = 2; i < 7; i++) {
            merkle.insertNote(note);
        }

        merkle.insertNoteCommitment(nc);
        merkle.insertNote(note);
        merkle.insertNoteCommitment(nc);

        for (uint256 i = 10; i < 16; i++) {
            merkle.insertNote(note);
        }

        uint256[] memory batch = new uint256[](16);
        for (uint256 i = 0; i < 16; i++) {
            batch[i] = nc;
        }

        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 _newRoot = path[path.length - 1];

        uint256 newRoot = 2148530186383747530821653986434349341874407543492575165183948509644419849075;

        assertEq(newRoot, _newRoot);

        uint256[] memory pis = merkle.calculatePublicInputs(newRoot);
        assertEq(
            pis[0],
            21443572485391568159800782191812935835534334817699172242223315142338162256601
        );
        assertEq(
            pis[1],
            2148530186383747530821653986434349341874407543492575165183948509644419849075
        );
        assertEq(pis[2], 805306368);
        assertEq(
            pis[3],
            14107635856823964757170274164259547430752493123869153100697144261772048072211
        );
    }

    function dummyProof() internal pure returns (uint256[8] memory) {
        uint256[8] memory res;
        return res;
    }

    function dummyNote() internal pure returns (EncodedNote memory) {
        EncodedNote memory note = EncodedNote({
            ownerH1: 16114171923265390730037465875328827721281782660087141077700479736598096658937,
            ownerH2: 10977258428915190383432832691667013955459124698254120657094471191004412212417,
            nonce: 1,
            encodedAssetAddr: 917551056842671309452305380979543736893630245704,
            encodedAssetId: 5,
            value: 100
        });

        return note;
    }
}
