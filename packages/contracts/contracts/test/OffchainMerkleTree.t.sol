// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "forge-std/Test.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {TreeUtils} from "../libs/TreeUtils.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {IHasherT3, IHasherT6} from "../interfaces/IHasher.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {IWallet} from "../interfaces/IWallet.sol";
import {PoseidonHasherT3, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";

contract TestOffchainMerkleTree is Test, TestUtils, PoseidonDeployer {
    using TreeTestLib for TreeTest;
    using OffchainMerkleTree for OffchainMerkleTreeData;

    OffchainMerkleTreeData merkle;
    ISubtreeUpdateVerifier verifier;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;
    TreeTest treeTest;

    event InsertNoteCommitments(uint256[] commitments);

    event InsertNotes(IWallet.Note[] notes);

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();
        verifier = ISubtreeUpdateVerifier(new TestSubtreeUpdateVerifier());
        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));
        treeTest.initialize(hasherT3, hasherT6);
        merkle.initialize(address(verifier));
    }

    function testTreeTest() public {
        // test that hashing empty batch gives EMPTY_SUBTREEgetRoot
        uint256[] memory batch = new uint256[](0);
        assertEq(
            treeTest.computeSubtreeRoot(batch),
            TreeTestLib.EMPTY_SUBTREE_ROOT
        );

        // test that hashing empty batch total givens EMPTY_TREE_ROOT
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
        IWallet.Note[] memory notes = new IWallet.Note[](1);
        notes[0] = dummyNote(1);
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
        IWallet.Note[] memory notes = new IWallet.Note[](5);
        for (uint256 i = 0; i < 5; i++) {
            notes[i] = dummyNote(i);
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

    function dummyProof() internal returns (uint256[8] memory) {
        uint256[8] memory res;
        return res;
    }

    function dummyNote(uint256 value) internal returns (IWallet.Note memory) {
        IWallet.Note memory note = IWallet.Note(0, 0, 0, 0, 0, value);

        return note;
    }
}
