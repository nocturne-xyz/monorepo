//spdx-license-identifier: unlicense
pragma solidity ^0.8.5;
import {IWallet} from "./IWallet.sol";

interface IOffchainMerkleTree {
    function _root() external view returns (uint256);

    function _count() external view returns (uint128);

    function totalCount() external view returns (uint128);

    function applySubtreeUpdate(uint256 newRoot, uint256[8] calldata proof)
        external;

    function insertNotes(IWallet.Note[] memory notes) external;

    function insertNote(IWallet.Note memory note) external;

    function insertNoteCommitments(uint256[] memory ncs) external;

    function insertNoteCommitment(uint256 nc) external;
}
