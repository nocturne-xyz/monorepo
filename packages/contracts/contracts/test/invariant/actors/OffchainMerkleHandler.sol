// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {IHasherT3} from "../../interfaces/IHasher.sol";
import {PoseidonHasherT3} from "../../utils/PoseidonHashers.sol";
import {Utils} from "../../../libs/Utils.sol";
import {TestSubtreeUpdateVerifier} from "../../harnesses/TestSubtreeUpdateVerifier.sol";
import {LibOffchainMerkleTree, OffchainMerkleTree} from "../../../libs/OffchainMerkleTree.sol";
import {QueueLib} from "../../../libs/Queue.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import "../../../libs/Types.sol";

contract OffchainMerkleHandler is CommonBase, StdCheats, StdUtils {
    using LibOffchainMerkleTree for OffchainMerkleTree;

    // ______PUBLIC______
    OffchainMerkleTree merkle;

    bytes32 public lastCall;
    uint256 public preCallRoot;
    uint256 public preCallGetCount;
    uint256 public preCallGetBatchLen;
    uint256 public preCallGetAccumulatorQueueLen;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    uint256 internal _rootCounter = 0;

    constructor() {
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();
        merkle.initialize(address(subtreeUpdateVerifier));

        preCallRoot = root();
        preCallGetCount = getCount();
        preCallGetBatchLen = batchLen();
        preCallGetAccumulatorQueueLen = accumulatorQueueLength();
    }

    modifier trackCall(bytes32 key) {
        preCallRoot = root();
        preCallGetCount = getCount();
        preCallGetBatchLen = batchLen();
        preCallGetAccumulatorQueueLen = accumulatorQueueLength();

        lastCall = key;
        _;
        _calls[lastCall]++;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("OffchainMerkleHandler call summary:");
        console.log("-------------------");
        console.log("insertNote", _calls["insertNote"]);
        console.log("insertNoteCommitments", _calls["insertNoteCommitments"]);
        console.log("applySubtreeUpdate", _calls["applySubtreeUpdate"]);
        console.log("no-op", _calls["no-op"]);
    }

    function insertNote(
        EncodedNote memory note
    ) public trackCall("insertNote") {
        merkle.insertNote(note);
    }

    function insertNoteCommitments(
        uint256[] memory ncs
    ) public trackCall("insertNoteCommitments") {
        for (uint256 i = 0; i < ncs.length; i++) {
            ncs[i] = bound(ncs[i], 0, Utils.SNARK_SCALAR_FIELD - 1);
        }
        merkle.insertNoteCommitments(ncs);
    }

    function applySubtreeUpdate(
        uint256[8] memory proof
    ) public trackCall("applySubtreeUpdate") {
        if (QueueLib.length(merkle.accumulatorQueue) != 0) {
            uint256 newRoot = _rootCounter + 1;
            merkle.applySubtreeUpdate(newRoot, proof);
            _rootCounter = newRoot;
        } else {
            lastCall = "no-op";
        }
    }

    function root() public view returns (uint256) {
        return merkle.root;
    }

    function getCount() public view returns (uint128) {
        return merkle.getCount();
    }

    function getTotalCount() public view returns (uint128) {
        return merkle.getTotalCount();
    }

    function batchLen() public view returns (uint128) {
        return merkle.batchLen;
    }

    function accumulatorQueueLength() public view returns (uint256) {
        return QueueLib.length(merkle.accumulatorQueue);
    }
}
