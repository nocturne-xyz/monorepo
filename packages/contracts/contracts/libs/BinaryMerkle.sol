// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

import {IHasherT3} from "../interfaces/IHasher.sol";

//TODO: test new functions added to ensure proper merkle roots are computed

// Each incremental tree has certain properties and data that will
// be used to add new leaves.
struct IncrementalTreeData {
    uint8 depth; // Depth of the tree (levels - 1).
    uint256 root; // Root hash of the tree.
    uint256 numberOfLeaves; // Number of leaves of the tree.
    IHasherT3 hasherT3; // HasherT3 contract
    mapping(uint256 => uint256) zeroes; // Zero hashes used for empty nodes (level -> _zero hash).
    // The nodes of the subtrees used in the last addition of a leaf (level -> [left node, right node]).
    mapping(uint256 => uint256[2]) lastSubtrees; // Caching these values is essential to efficient appends.
}

/// @title Incremental binary Merkle tree.
/// @dev The incremental tree allows to calculate the root hash each time a leaf is added, ensuring
/// the integrity of the tree.
library BinaryMerkle {
    uint8 internal constant MAX_DEPTH = 32;
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @dev Initializes a tree.
    /// @param self: Tree data.
    /// @param _depth: Depth of the tree.
    /// @param _zero: Zero value to be used.
    function initialize(
        IncrementalTreeData storage self,
        uint8 _depth,
        uint256 _zero,
        IHasherT3 _hasherT3
    ) internal {
        require(_zero < SNARK_SCALAR_FIELD, "Leaf must be < snark field");
        require(
            _depth > 0 && _depth <= MAX_DEPTH,
            "Depth must be between 1 and 32"
        );

        self.depth = _depth;
        self.hasherT3 = _hasherT3;

        for (uint8 i = 0; i < _depth; i++) {
            self.zeroes[i] = _zero;
            _zero = self.hasherT3.hash([_zero, _zero]);
        }

        self.root = _zero;
    }

    /// @dev Inserts a leaf in the tree.
    /// @param self: Tree data.
    /// @param _leaf: Leaf to be inserted.
    function insert(IncrementalTreeData storage self, uint256 _leaf) internal {
        require(_leaf < SNARK_SCALAR_FIELD, "Leaf must be < snark field");
        require(
            self.numberOfLeaves < 2 ** self.depth,
            "BinaryTree: tree is full"
        );

        uint256 _index = self.numberOfLeaves;
        uint256 _hash = _leaf;

        for (uint8 i = 0; i < self.depth; i++) {
            if (_index % 2 == 0) {
                self.lastSubtrees[i] = [_hash, self.zeroes[i]];
            } else {
                self.lastSubtrees[i][1] = _hash;
            }

            _hash = self.hasherT3.hash(self.lastSubtrees[i]);
            _index /= 2;
        }

        self.root = _hash;
        self.numberOfLeaves += 1;
    }

    function insert2(
        IncrementalTreeData storage self,
        uint256[2] memory _leaves
    ) internal {
        for (uint256 i = 0; i < 2; i++) {
            require(
                _leaves[i] < SNARK_SCALAR_FIELD,
                "Leaf must be < snark field"
            );
        }
        require(
            self.numberOfLeaves + 2 <= 2 ** self.depth,
            "BinaryTree: tree is full"
        );

        uint256 _index = self.numberOfLeaves / 2;
        uint256 _hash = self.hasherT3.hash(_leaves);

        for (uint8 i = 1; i < self.depth; i++) {
            if (_index % 2 == 0) {
                self.lastSubtrees[i] = [_hash, self.zeroes[i]];
            } else {
                self.lastSubtrees[i][1] = _hash;
            }

            _hash = self.hasherT3.hash(self.lastSubtrees[i]);
            _index /= 2;
        }

        self.root = _hash;
        self.numberOfLeaves += 2;
    }

    function insert8(
        IncrementalTreeData storage self,
        uint256[8] memory _leaves
    ) internal {
        for (uint256 i = 0; i < 8; i++) {
            require(
                _leaves[i] < SNARK_SCALAR_FIELD,
                "Leaf must be < snark field"
            );
        }
        require(
            self.numberOfLeaves + 8 <= 2 ** self.depth,
            "BinaryTree: tree is full"
        );

        uint256 _index = self.numberOfLeaves / 8;

        uint256 _hash = getRootFrom8(self, _leaves);

        for (uint8 i = 2; i < self.depth; i++) {
            if (_index % 2 == 0) {
                self.lastSubtrees[i] = [_hash, self.zeroes[i]];
            } else {
                self.lastSubtrees[i][1] = _hash;
            }

            _hash = self.hasherT3.hash(self.lastSubtrees[i]);
            _index /= 2;
        }

        self.root = _hash;
        self.numberOfLeaves += 8;
    }

    // TODO: make sure we can allow both insert16 and insert8, that self.lastSubtrees is properly set
    function insert16(
        IncrementalTreeData storage self,
        uint256[16] memory _leaves
    ) internal {
        for (uint256 i = 0; i < 16; i++) {
            require(
                _leaves[i] < SNARK_SCALAR_FIELD,
                "Leaf must be < snark field"
            );
        }
        require(
            self.numberOfLeaves + 16 <= 2 ** self.depth,
            "BinaryTree: tree is full"
        );

        uint256 _hash = getRootFrom16(self, _leaves);
        uint256 _index = self.numberOfLeaves / 16;

        for (uint8 i = 3; i < self.depth; i++) {
            if (_index % 2 == 0) {
                self.lastSubtrees[i] = [_hash, self.zeroes[i]];
            } else {
                self.lastSubtrees[i][1] = _hash;
            }

            _hash = self.hasherT3.hash(self.lastSubtrees[i]);
            _index /= 2;
        }

        self.root = _hash;
        self.numberOfLeaves += 16;
    }

    function getRootFrom8(
        IncrementalTreeData storage self,
        uint256[8] memory _leaves
    ) internal view returns (uint256) {
        uint256 _leftHash = self.hasherT3.hash(
            [
                self.hasherT3.hash([_leaves[0], _leaves[1]]),
                self.hasherT3.hash([_leaves[2], _leaves[3]])
            ]
        );

        uint256 _rightHash = self.hasherT3.hash(
            [
                self.hasherT3.hash([_leaves[4], _leaves[5]]),
                self.hasherT3.hash([_leaves[6], _leaves[7]])
            ]
        );

        return self.hasherT3.hash([_leftHash, _rightHash]);
    }

    function getRootFrom16(
        IncrementalTreeData storage self,
        uint256[16] memory _leaves
    ) internal view returns (uint256) {
        uint256[8] memory _leftHalf;
        uint256[8] memory _rightHalf;
        for (uint256 i = 0; i < 8; i++) {
            _leftHalf[i] = _leaves[i];
            _rightHalf[i] = _leaves[i * 2];
        }
        return
            self.hasherT3.hash(
                [getRootFrom8(self, _leftHalf), getRootFrom8(self, _rightHalf)]
            );
    }
}
