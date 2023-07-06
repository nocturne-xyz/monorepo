// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// External
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
// Internal
import "./libs/Types.sol";

contract TellerBase is EIP712Upgradeable {
    bytes32 public constant OPERATION_REQUEST_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "Operation(JoinSplit[] joinSplits,CompressedStealthAddress refundAddr,EncodedAsset[] encodedRefundAssets,Action[] actions,EncodedAsset encodedGasAsset,uint256 gasAssetRefundThreshold,uint256 executionGasLimit,uint256 maxNumRefunds,uint256 gasPrice,uint256 chainId,uint256 deadline,bool atomicActions)Action(address contractAddress,bytes encodedFunction)CompressedStealthAddress(uint256 h1,uint256 h2)EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 encSenderCanonAddrC1,uint256 encSenderCanonAddrC2,uint256[8] proof,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(CompressedStealthAddress owner,uint256 encappedKey,uint256 encryptedNonce,uint256 encryptedValue)"
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
                "EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 encSenderCanonAddrC1,uint256 encSenderCanonAddrC2,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)"
            )
        );

    bytes32 public constant ENCRYPTED_NOTE_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "EncryptedNote(CompressedStealthAddress owner,uint256 encappedKey,uint256 encryptedNonce,uint256 encryptedValue)"
            )
        );

    bytes32 public constant ENCODED_ASSET_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"
        );

    /// @notice Internal initializer
    /// @param contractName Name of the contract
    /// @param contractVersion Version of the contract
    function __TellerBase_init(
        string memory contractName,
        string memory contractVersion
    ) internal onlyInitializing {
        __EIP712_init(contractName, contractVersion);
    }

    // /// @notice Hashes operation
    // /// @param op Operation
    // function _hashDepositRequest(
    //     Operation memory op
    // ) internal pure returns (bytes32) {
    //     return
    //         keccak256(
    //             abi.encode(
    //                 OPERATION_REQUEST_TYPEHASH,

    //             )
    //         );
    // }

    function _hashJoinSplits(
        JoinSplit[] calldata joinSplits
    ) internal pure returns (bytes32) {
        bytes memory joinSplitsPayload;
        uint256 numJoinSplits = joinSplits.length;
        for (uint256 i = 0; i < numJoinSplits; i++) {
            joinSplitsPayload = abi.encode(
                joinSplitsPayload,
                abi.encode(
                    joinSplits[i].commitmentTreeRoot,
                    joinSplits[i].nullifierA,
                    joinSplits[i].nullifierB,
                    joinSplits[i].newNoteACommitment,
                    joinSplits[i].newNoteBCommitment,
                    joinSplits[i].publicSpend,
                    _hashEncodedAsset(joinSplits[i].encodedAsset),
                    _hashEncryptedNote(
                        joinSplits[i].newNoteAEncrypted
                    ),
                    _hashEncryptedNote(
                        joinSplits[i].newNoteBEncrypted
                    )
                )
            );
        }

        return keccak256(joinSplitsPayload);
    }

    /// @notice Hashes encrypted note
    /// @param encryptedNote Encrypted note
    function _hashEncryptedNote(
        EncryptedNote calldata encryptedNote
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ENCRYPTED_NOTE_TYPEHASH,
                _hashCompressedStealthAddress(encryptedNote.owner),
                encryptedNote.encappedKey,
                encryptedNote.encryptedNonce,
                encryptedNote.encryptedValue
            )
        );
    }

    /// @notice Hashes stealth address
    /// @param stealthAddress Compressed stealth address
    function _hashCompressedStealthAddress(
        CompressedStealthAddress memory stealthAddress
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

    /// @notice Hashes encoded asset
    /// @param encodedAsset Encoded asset
    function _hashEncodedAsset(
        EncodedAsset memory encodedAsset
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
