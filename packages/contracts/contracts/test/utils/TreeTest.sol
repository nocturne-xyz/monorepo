// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;
import {IWallet} from "../../interfaces/IWallet.sol";
import {IHasherT3, IHasherT6} from "../../interfaces/IHasher.sol";
import {Utils} from "../../libs/Utils.sol";
import "forge-std/Test.sol";

struct TreeTest {
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;
}

library TreeTestLib {
    uint256 public constant EMPTY_SUBTREE_ROOT =
        3607627140608796879659380071776844901612302623152076817094415224584923813162;

    function initialize(
        TreeTest storage self,
        IHasherT3 _hasherT3,
        IHasherT6 _hasherT6
    ) internal {
        self.hasherT3 = _hasherT3;
        self.hasherT6 = _hasherT6;
    }

    function computeSubtreeRoot(TreeTest storage self, uint256[] memory batch)
        internal
        returns (uint256)
    {
        require(batch.length <= Utils.BATCH_SIZE, "batch too large");
        uint256[] memory scratch = new uint256[](Utils.BATCH_SIZE);
        for (uint256 i = 0; i < batch.length; i++) {
            scratch[i] = batch[i];
        }

        for (int256 i = int256(Utils.BATCH_SUBTREE_DEPTH - 1); i >= 0; i--) {
            for (uint256 j = 0; j < 2**uint256(i); j++) {
                uint256 left = scratch[2 * j];
                uint256 right = scratch[2 * j + 1];
                scratch[j] = self.hasherT3.hash([left, right]);
            }
        }

        return scratch[0];
    }

    // compute the new tree root after inserting a batch to an empty tree
    // returns the path to the subtree, from the subtree root (inclusive) to the overall tree root
    function computeInitialRoot(TreeTest storage self, uint256[] memory batch)
        internal
        returns (uint256[] memory)
    {
        uint256 subtreeRoot = computeSubtreeRoot(self, batch);
        uint256 zero = EMPTY_SUBTREE_ROOT;

        uint256[] memory path = new uint256[](
            Utils.DEPTH - Utils.BATCH_SUBTREE_DEPTH + 1
        );
        path[0] = subtreeRoot;
        for (uint256 i = 0; i < Utils.DEPTH - Utils.BATCH_SUBTREE_DEPTH; i++) {
            path[i + 1] = self.hasherT3.hash([path[i], zero]);
            zero = self.hasherT3.hash([zero, zero]);
        }

        return path;
    }

    // comput the new tree root after inserting a batch given thue path to the rightmost subtree
    // idx is the index of the leftmost leaf in the subtree
    function computeNewRoot(
        TreeTest storage self,
        uint256[] memory batch,
        uint256[] memory path,
        uint256 idx
    ) internal returns (uint256[] memory) {
        uint256 subtreeRoot = computeSubtreeRoot(self, batch);
        uint256 subtreeIdx = idx >> Utils.BATCH_SUBTREE_DEPTH;
        uint256 zero = EMPTY_SUBTREE_ROOT;

        uint256[] memory newPath = new uint256[](
            Utils.DEPTH - Utils.BATCH_SUBTREE_DEPTH + 1
        );
        newPath[0] = subtreeRoot;
        for (uint256 i = 0; i < Utils.DEPTH - Utils.BATCH_SUBTREE_DEPTH; i++) {
            if (subtreeIdx & 1 == 1) {
                newPath[i + 1] = self.hasherT3.hash([path[i], newPath[i]]);
            } else {
                newPath[i + 1] = self.hasherT3.hash([newPath[i], zero]);
            }

            zero = self.hasherT3.hash([zero, zero]);
            subtreeIdx >>= 1;
        }

        return newPath;
    }

    function computeNoteCommitment(
        TreeTest storage self,
        IWallet.Note memory note
    ) internal returns (uint256) {
        uint256 addrHash = self.hasherT3.hash([note.ownerH1, note.ownerH2]);
        return
            self.hasherT6.hash(
                [addrHash, note.nonce, note.asset, note.id, note.value]
            );
    }
}
