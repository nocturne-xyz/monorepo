// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import "./interfaces/ISubtreeUpdateVerifier.sol";
import {QueueLib} from "./libs/Queue.sol";
import {FieldUtils} from "./libs/FieldUtils.sol";
import {IHasherT3} from "./interfaces/IHasher.sol";


contract OffchainMerkleTree {
    using QueueLib for QueueLib.Queue;

	uint256 internal constant ZERO = 0;
    uint256 internal constant LOG2_BATCH_SIZE = 4;
    uint256 internal constant BATCH_SIZE = 1 << LOG2_BATCH_SIZE;
    uint256 internal constant LOG2_DEPTH = 5;
    uint256 internal constant DEPTH = 1 << LOG2_DEPTH;

    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // number of non-zero leaves in the tree
    // INVARIANT: bottom `LOG2_BATCH_SIZE` bits of `len` should all be zero
    uint128 len;
    // number of leaves in the batch
    // when this gets to BATCH_SIZE, we compute accumulatorHash and push te the queue
    uint128 batchLen;

    // root of the merkle tree
    uint256 root;

    // current batch of updates to accumulate
    uint256[BATCH_SIZE] batch;

	ISubtreeUpdateVerifier public verifier;
    QueueLib.Queue public queue;


    event LeavesEnqueued(uint256[] leaves);

    constructor(
        address _hasherT3,
        address _verifier
    ) {
        root = ZERO;
        len = 0;
        batchLen = 0;
        verifier = ISubtreeUpdateVerifier(_verifier);

        // compute the initial root corresponding to the tree of depth `depth` containing all zeros
        IHasherT3 hasher = IHasherT3(_hasherT3);
        for (uint256 i = 0; i < DEPTH; i++) {
            root = hasher.hash([root, root]);
        }

        queue.initialize();
    }

    function getRoot() external view returns (uint256) {
        return root;
    }

    function getLen() external view returns (uint128) {
        return len;
    }

    function getBatchLen() external view returns (uint128) {
        return batchLen;
    }

    function insertLeafToQueue(uint256 leaf) external {
        if (batchLen == BATCH_SIZE) {
            accumulate();
        }

        batch[batchLen] = leaf;
        batchLen += 1;

        uint256[] memory leaves = new uint256[](1);
        leaves[0] = leaf;
        emit LeavesEnqueued(leaves);
    }

    function insertLeavesToQueue(uint256[] memory leaves) external {
        queue.enqueue(leaves);
        emit LeavesEnqueued(leaves);
    }

    function accumulate() internal {
        require(batchLen == BATCH_SIZE);
        uint256[] memory _batch = new uint256[](BATCH_SIZE);
        for (uint256 i = 0; i < BATCH_SIZE; i++) {
            _batch[i] = batch[i];
        }

        uint256 accumulatorHash = FieldUtils.sha256FieldElemsToUint256(_batch);
        queue.enqueue(accumulatorHash);
        batchLen = 0;
    }
    
	function append16(
        uint256 newRoot,
        uint256[8] calldata proof
    ) external {
        uint256 accumulatorHash = queue.peek();
        (uint256 hi, uint256 lo) = FieldUtils.uint256ToFieldElemLimbs(accumulatorHash);

        // len is r + s bits
        // get bottom `r` bits of the path
        uint256 encodedPathAndHash = uint256(len) >> LOG2_BATCH_SIZE;
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
        len += uint128(BATCH_SIZE);
    }

}