// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {AssetUtils} from "../../../libs/AssetUtils.sol";
import {TestCommitmentTreeManager} from "../../harnesses/TestCommitmentTreeManager.sol";
import {IncrementalTree, LibIncrementalTree} from "../../utils/IncrementalTree.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {TreeUtils} from "../../../libs/TreeUtils.sol";
import {Utils} from "../../../libs/Utils.sol";
import {InvariantUtils} from "../helpers/InvariantUtils.sol";
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler is InvariantUtils {
    uint256 constant ERC20_ID = 0;

    using LibIncrementalTree for IncrementalTree;

    // ______PUBLIC______
    TestCommitmentTreeManager public commitmentTreeManager;
    address public subtreeBatchFiller;

    uint256 public ghost_joinSplitLeafCount = 0;
    uint256 public ghost_refundNotesLeafCount = 0;
    uint256 public ghostfillBatchWithZerosLeafCount = 0;
    uint256 public ghost_insertNoteLeafCount = 0;
    uint256 public ghost_insertNoteCommitmentsLeafCount = 0;

    bytes32 public lastCall;
    uint256 public preCallTotalCount;
    uint256 public insertNoteCommitmentsLength;
    uint256 public insertNotesLength;
    uint256 public handleJoinSplitsLength;
    uint256 public handleRefundNotesLength;
    JoinSplit public lastHandledJoinSplit;

    // ______INTERNAL______
    IncrementalTree _mirrorTree;
    mapping(bytes32 => uint256) internal _calls;
    uint256 internal _rootCounter = 0;
    uint256 internal _nullifierCounter = 0;
    uint256 internal reRandomizationCounter = 0;

    constructor(
        TestCommitmentTreeManager _commitmentTreeManager,
        address _subtreeBatchFiller
    ) {
        commitmentTreeManager = _commitmentTreeManager;
        subtreeBatchFiller = _subtreeBatchFiller;
    }

    modifier trackCall(bytes32 key) {
        preCallTotalCount = commitmentTreeManager.totalCount();

        lastCall = key;
        _;
        _calls[lastCall]++;
    }

    function callSummary() external view {
        console.log("-------------------");
        console.log("CommitmentTreeManagerHandler call summary:");
        console.log("-------------------");
        console.log("applySubtreeUpdate", _calls["applySubtreeUpdate"]);
        console.log("handleJoinSplits", _calls["handleJoinSplits"]);
        console.log("handleRefundNote", _calls["handleRefundNote"]);
        console.log("fillBatchWithZeros", _calls["fillBatchWithZeros"]);
        console.log("insertNote", _calls["insertNote"]);
        console.log("insertNoteCommitments", _calls["insertNoteCommitments"]);
        console.log("no-op", _calls["no-op"]);
    }

    function applySubtreeUpdate(
        uint256[8] memory proof
    ) public trackCall("applySubtreeUpdate") {
        if (commitmentTreeManager.accumulatorQueueLen() > 0) {
            uint256 newRoot = _rootCounter;
            commitmentTreeManager.applySubtreeUpdate(newRoot, proof);
            _rootCounter += 1;
        } else {
            lastCall = "no-op";
        }
    }

    function handleJoinSplits(
        uint256 seed
    ) public trackCall("handleJoinSplits") {
        uint256 numJoinSplits = bound(seed, 1, 10);

        JoinSplit[] memory joinSplits = new JoinSplit[](numJoinSplits);
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplits[i] = _generateJoinSplit(seed);
        }

        commitmentTreeManager.handleJoinSplits(joinSplits);
        lastHandledJoinSplit = joinSplits[numJoinSplits - 1];
        handleJoinSplitsLength = numJoinSplits;
        _nullifierCounter += 2 * numJoinSplits;
        ghost_joinSplitLeafCount += 2 * numJoinSplits; // call could not have completed without adding 2 * numJoinSplit leaves
    }

    function handleRefundNote(
        uint256 seed
    ) public trackCall("handleRefundNote") {
        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(uint160(bound(_rerandomize(seed), 0, (1 << 160) - 1))),
            ERC20_ID
        );

        StealthAddress memory refundAddr = StealthAddress({
            h1: bound(
                _rerandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            ),
            h2: bound(
                _rerandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            )
        });

        commitmentTreeManager.handleRefundNote(encodedAsset, refundAddr, seed);
        ghost_refundNotesLeafCount += 1;
        handleRefundNotesLength = 1;
    }

    function fillBatchWithZeros() public trackCall("fillBatchWithZeros") {
        uint256 leavesLeft = TreeUtils.BATCH_SIZE -
            commitmentTreeManager.currentBatchLen();
        if (leavesLeft != TreeUtils.BATCH_SIZE) {
            vm.prank(subtreeBatchFiller);
            commitmentTreeManager.fillBatchWithZeros();
            ghostfillBatchWithZerosLeafCount += leavesLeft;
        } else {
            lastCall = "no-op";
        }
    }

    function insertNote(
        EncodedNote memory note
    ) public trackCall("insertNote") {
        commitmentTreeManager.insertNote(note);
        ghost_insertNoteLeafCount += 1;
        insertNotesLength = 1;
    }

    function insertNoteCommitments(
        uint256[] memory ncs
    ) public trackCall("insertNoteCommitments") {
        for (uint256 i = 0; i < ncs.length; i++) {
            ncs[i] = bound(ncs[i], 0, Utils.BN254_SCALAR_FIELD_MODULUS - 1);
        }

        commitmentTreeManager.insertNoteCommitments(ncs);
        insertNoteCommitmentsLength = ncs.length;
        ghost_insertNoteCommitmentsLeafCount += ncs.length;
    }

    function _generateJoinSplit(
        uint256 seed
    ) internal returns (JoinSplit memory _joinSplit) {
        _joinSplit.newNoteACommitment = bound(
            _rerandomize(seed),
            0,
            Utils.BN254_SCALAR_FIELD_MODULUS - 1
        );
        _joinSplit.newNoteBCommitment = bound(
            _rerandomize(seed),
            0,
            Utils.BN254_SCALAR_FIELD_MODULUS - 1
        );
        _joinSplit.commitmentTreeRoot = commitmentTreeManager.root();
        _joinSplit.nullifierA = _nullifierCounter;
        _joinSplit.nullifierB = _nullifierCounter + 1;
        _nullifierCounter += 2;
    }
}
