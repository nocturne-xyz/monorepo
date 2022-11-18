// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/ISubtreeUpdateVerifier.sol";
import {IOffchainMerkleTree} from "./interfaces/IOffchainMerkleTree.sol";
import {QueueLib} from "./libs/Queue.sol";
import {FieldUtils} from "./libs/FieldUtils.sol";
import {IHasherT3} from "./interfaces/IHasher.sol";


contract OffchainMerkleTree is IOffchainMerkleTree {
    using QueueLib for QueueLib.Queue;

	uint256 public constant ZERO = 0;
    uint256 public constant LOG2_BATCH_SIZE = 4;
    uint256 public constant BATCH_SIZE = 1 << LOG2_BATCH_SIZE;
    uint256 public constant LOG2_DEPTH = 5;
    uint256 public constant DEPTH = 1 << LOG2_DEPTH;

    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `count` should all be zero
    uint128 public count;
    // number of leaves in the batch
    // when this gets to BATCH_SIZE, we compute accumulatorHash and push te the queue
    uint128 public batchLen;

    // root of the merkle tree
    uint256 public root;

    // current batch of updates to accumulate
    uint256[BATCH_SIZE] public batch;

	ISubtreeUpdateVerifier public verifier;
    QueueLib.Queue public queue;


    event LeavesEnqueued(uint256[] leaves);
    event LeavesCommitted(uint128 subtreeIndex, uint256 newRoot);

    constructor(
        address _verifier,
        address _hasherT3
    ) {
        root = ZERO;
        count = 0;
        batchLen = 0;
        verifier = ISubtreeUpdateVerifier(_verifier);

        // compute the initial root corresponding to the tree of depth `depth` containing all zeros
        IHasherT3 hasher = IHasherT3(_hasherT3);
        for (uint256 i = 0; i < DEPTH; i++) {
            root = hasher.hash([root, root]);
        }

        queue.initialize();
    }

    function getRoot() external view override returns (uint256) {
        return root;
    }

    function committedCount() external view override returns (uint128) {
        return count;
    }

    function totalCount() external view override returns (uint128) {
        return count + batchLen + uint128(BATCH_SIZE) * uint128(queue.length());
    }

    function getBatchLen() external view override returns (uint128) {
        return batchLen;
    }

    function insertLeafToQueue(uint256 leaf) external override {
        batch[batchLen] = leaf;
        batchLen += 1;

        if (batchLen == BATCH_SIZE) {
            accumulate();
        }

        uint256[] memory leaves = new uint256[](1);
        leaves[0] = leaf;
        emit LeavesEnqueued(leaves);
    }

    function insertLeavesToQueue(uint256[] memory leaves) external override {
        for (uint256 i = 0; i < leaves.length; i++) {
            batch[batchLen] = leaves[i];
            batchLen += 1;

            if (batchLen == BATCH_SIZE) {
                accumulate();
            }
        }
        emit LeavesEnqueued(leaves);
    }

    function computeAccumulatorHash() internal view returns (uint256) {
        uint256[] memory _batch = new uint256[](BATCH_SIZE);
        for (uint256 i = 0; i < batchLen ; i++) {
            _batch[i] = batch[i];
        }
        for (uint256 i = batchLen; i < BATCH_SIZE; i++) {
            _batch[i] = ZERO;
        }

        return FieldUtils.sha256FieldElemsToUint256(_batch);
    }

    function accumulate() internal {
        uint256 accumulatorHash = computeAccumulatorHash();
        queue.enqueue(accumulatorHash);
        batchLen = 0;
    }

	function commitSubtree(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external override {
        uint256 accumulatorHash = queue.peek();
        (uint256 hi, uint256 lo) = FieldUtils.uint256ToFieldElemLimbs(accumulatorHash);

        // count is r + s bits
        // get bottom `r` bits of the path
        uint256 encodedPathAndHash = uint256(count) >> LOG2_BATCH_SIZE;
        // pack the top 3 bits of accumulatorhash to get r + 3 bits
        encodedPathAndHash |= hi << (LOG2_DEPTH - LOG2_BATCH_SIZE);

        require(
            verifier.verifyProof(
                [proof[0], proof[1]],
                [
                    [proof[2], proof[3]],
                    [proof[4], proof[5]]
                ],
                [proof[6], proof[7]],
                [
                    root,
                    newRoot,
                    encodedPathAndHash,
                    lo
                ]
            ),
            "subtree update proof invalid"
        );

        queue.dequeue(); 
        root = newRoot;
        count += uint128(BATCH_SIZE);
    }

}