// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// External
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
// Internal
import {Utils} from "./libs/Utils.sol";
import "./libs/Types.sol";

contract OperationEIP712 is EIP712Upgradeable {
    bytes32 public constant OPERATION_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "OperationWithoutProofs(JoinSplitWithoutProof[] joinSplits,CompressedStealthAddress refundAddr,EncodedAsset[] encodedRefundAssets,Action[] actions,EncodedAsset encodedGasAsset,uint256 gasAssetRefundThreshold,uint256 executionGasLimit,uint256 maxNumRefunds,uint256 gasPrice,uint256 deadline,bool atomicActions)Action(address contractAddress,bytes encodedFunction)CompressedStealthAddress(uint256 h1,uint256 h2)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)JoinSplitWithoutProof(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)"
            )
        );

    bytes32 public constant ACTION_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "Action(address contractAddress,bytes encodedFunction)"
            )
        );

    bytes32 public constant COMPRESSED_STEALTH_ADDRESS_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "CompressedStealthAddress(uint256 h1,uint256 h2)"
        );

    bytes32 public constant EIP712_JOINSPLIT_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "JoinSplitWithoutProof(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)"
            )
        );

    bytes32 public constant ENCODED_ASSET_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"
        );

    bytes32 public constant ENCRYPTED_NOTE_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)"
            )
        );

    /// @notice Internal initializer
    /// @param contractName Name of the contract
    /// @param contractVersion Version of the contract
    function __OperationEIP712_init(
        string memory contractName,
        string memory contractVersion
    ) internal onlyInitializing {
        __EIP712_init(contractName, contractVersion);
    }

    /// @notice Computes EIP712 digest of operation
    /// @dev The inherited EIP712 domain separator includes block.chainid for replay protection.
    /// @param op OperationWithoutProof
    function _computeDigest(
        Operation calldata op
    ) public view returns (uint256) {
        bytes32 domainSeparator = _domainSeparatorV4();
        bytes32 structHash = _hashOperation(op);

        bytes32 digest = ECDSAUpgradeable.toTypedDataHash(
            domainSeparator,
            structHash
        );

        // mod digest by BN254 since this is PI to joinsplit circuit
        return uint256(digest) % Utils.BN254_SCALAR_FIELD_MODULUS;
    }

    /// @notice Hashes operation
    /// @param op Operation
    /// @dev We hash every field of operation except for the joinsplit proofs
    function _hashOperation(
        Operation calldata op
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    OPERATION_TYPEHASH,
                    _hashJoinSplits(op.joinSplits),
                    _hashCompressedStealthAddress(op.refundAddr),
                    _hashEncodedRefundAssets(op.encodedRefundAssets),
                    _hashActions(op.actions),
                    _hashEncodedAsset(op.encodedGasAsset),
                    op.gasAssetRefundThreshold,
                    op.executionGasLimit,
                    op.maxNumRefunds,
                    op.gasPrice,
                    op.deadline,
                    uint256(op.atomicActions ? 1 : 0)
                )
            );
    }

    /// @notice Hashes array of joinsplits
    /// @param joinSplits JoinSplits
    /// @dev We hash every field except for the joinSplit proofs
    function _hashJoinSplits(
        JoinSplit[] calldata joinSplits
    ) internal pure returns (bytes32) {
        uint256 numJoinSplits = joinSplits.length;
        bytes32[] memory joinSplitHashes = new bytes32[](numJoinSplits);
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplitHashes[i] = _hashJoinSplit(joinSplits[i]);
        }

        return keccak256(abi.encodePacked(joinSplitHashes));
    }

    /// @notice Hashes single joinsplit
    /// @param joinSplit JoinSplit
    /// @dev We hash every field except for the proof
    function _hashJoinSplit(
        JoinSplit calldata joinSplit
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_JOINSPLIT_TYPEHASH,
                    joinSplit.commitmentTreeRoot,
                    joinSplit.nullifierA,
                    joinSplit.nullifierB,
                    joinSplit.newNoteACommitment,
                    joinSplit.newNoteBCommitment,
                    joinSplit.senderCommitment,
                    _hashEncodedAsset(joinSplit.encodedAsset),
                    joinSplit.publicSpend,
                    _hashEncryptedNote(joinSplit.newNoteAEncrypted),
                    _hashEncryptedNote(joinSplit.newNoteBEncrypted)
                )
            );
    }

    /// @notice Hashes array of actions
    /// @param actions Actions
    function _hashActions(
        Action[] calldata actions
    ) internal pure returns (bytes32) {
        uint256 numActions = actions.length;
        bytes32[] memory actionHashes = new bytes32[](numActions);
        for (uint256 i = 0; i < numActions; i++) {
            actionHashes[i] = _hashAction(actions[i]);
        }

        return keccak256(abi.encodePacked(actionHashes));
    }

    /// @notice Hashes single action
    /// @param action Action
    function _hashAction(
        Action calldata action
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ACTION_TYPEHASH,
                    action.contractAddress,
                    keccak256(action.encodedFunction)
                )
            );
    }

    /// @notice Hashes encrypted note
    /// @param encryptedNote Encrypted note
    function _hashEncryptedNote(
        EncryptedNote calldata encryptedNote
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ENCRYPTED_NOTE_TYPEHASH,
                    keccak256(encryptedNote.ciphertextBytes),
                    keccak256(encryptedNote.encapsulatedSecretBytes)
                )
            );
    }

    /// @notice Hashes stealth address
    /// @param stealthAddress Compressed stealth address
    function _hashCompressedStealthAddress(
        CompressedStealthAddress calldata stealthAddress
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    COMPRESSED_STEALTH_ADDRESS_TYPEHASH,
                    stealthAddress.h1,
                    stealthAddress.h2
                )
            );
    }

    /// @notice Hashes encoded refund assets
    /// @param encodedRefundAssets Encoded refund assets
    function _hashEncodedRefundAssets(
        EncodedAsset[] calldata encodedRefundAssets
    ) internal pure returns (bytes32) {
        uint256 numRefundAssets = encodedRefundAssets.length;
        bytes32[] memory assetHashes = new bytes32[](numRefundAssets);
        for (uint256 i = 0; i < numRefundAssets; i++) {
            assetHashes[i] = _hashEncodedAsset(encodedRefundAssets[i]);
        }

        return keccak256(abi.encodePacked(assetHashes));
    }

    /// @notice Hashes encoded asset
    /// @param encodedAsset Encoded asset
    function _hashEncodedAsset(
        EncodedAsset calldata encodedAsset
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ENCODED_ASSET_TYPEHASH,
                    encodedAsset.encodedAssetAddr,
                    encodedAsset.encodedAssetId
                )
            );
    }
}
