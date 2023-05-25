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
import "../../../libs/Types.sol";

contract CommitmentTreeManagerHandler is Test {
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
    uint256 internal seedRerandomizationCounter = 0;

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
        console.log("handleRefundNotes", _calls["handleRefundNotes"]);
        console.log("fillBatchWithZeros", _calls["fillBatchWithZeros"]);
        console.log("insertNotes", _calls["insertNotes"]);
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
        JoinSplit[] memory joinSplits
    ) public trackCall("handleJoinSplits") {
        uint256 numJoinSplits = joinSplits.length;
        if (numJoinSplits == 0) {
            lastCall = "no-op";
            return;
        }

        for (uint256 i = 0; i < joinSplits.length; i++) {
            joinSplits[i].commitmentTreeRoot = commitmentTreeManager.root();
            joinSplits[i].nullifierA = _nullifierCounter + 2 * i;
            joinSplits[i].nullifierB = _nullifierCounter + 2 * i + 1;
            joinSplits[i].newNoteACommitment = bound(
                joinSplits[i].newNoteACommitment,
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            );
            joinSplits[i].newNoteBCommitment = bound(
                joinSplits[i].newNoteBCommitment,
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            );
        }

        commitmentTreeManager.handleJoinSplits(joinSplits);
        lastHandledJoinSplit = joinSplits[numJoinSplits - 1];
        handleJoinSplitsLength = numJoinSplits;
        _nullifierCounter += 2 * numJoinSplits;
        ghost_joinSplitLeafCount += 2 * numJoinSplits; // call could not have completed without adding 2 * numJoinSplit leaves
    }

    function handleRefundNotes(
        uint256 seed
    ) public trackCall("handleRefundNotes") {
        uint256 numRefunds = bound(_reRandomize(seed), 0, 17);

        if (numRefunds == 0) {
            lastCall = "no-op";
            return;
        }

        uint256 maxNumRefunds = bound(
            _reRandomize(seed),
            numRefunds,
            numRefunds + 20
        );

        EncodedAsset[] memory encodedAssets = new EncodedAsset[](maxNumRefunds);
        StealthAddress[] memory refundAddrs = new StealthAddress[](
            maxNumRefunds
        );
        uint256[] memory values = new uint256[](maxNumRefunds);

        StealthAddress memory refundAddr = StealthAddress({
            h1X: bound(
                _reRandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            ),
            h1Y: bound(
                _reRandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            ),
            h2X: bound(
                _reRandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            ),
            h2Y: bound(
                _reRandomize(seed),
                0,
                Utils.BN254_SCALAR_FIELD_MODULUS - 1
            )
        });

        for (uint256 i = 0; i < maxNumRefunds; i++) {
            encodedAssets[i] = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(uint160(bound(_reRandomize(seed), 0, (1 << 160) - 1))),
                ERC20_ID
            );

            values[i] = bound(_reRandomize(seed), 0, (1 << 252) - 1);
        }

        commitmentTreeManager.handleRefundNotes(
            encodedAssets,
            values,
            refundAddr,
            numRefunds
        );
        ghost_refundNotesLeafCount += numRefunds;
        handleRefundNotesLength = numRefunds;
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

    function insertNotes(
        EncodedNote[] memory notes
    ) public trackCall("insertNotes") {
        commitmentTreeManager.insertNotes(notes);
        ghost_insertNoteLeafCount += notes.length;
        insertNotesLength = notes.length;
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

    function _reRandomize(uint256 seed) internal returns (uint256) {
        uint256 newRandom;
        unchecked {
            newRandom = uint256(
                keccak256(
                    abi.encodePacked(seed, uint256(seedRerandomizationCounter))
                )
            );
            seedRerandomizationCounter++;
        }

        return newRandom;
    }
}
