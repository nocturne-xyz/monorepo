import { ethers } from "ethers";
import {
  Action,
  EncryptedNote,
  PreSignJoinSplit,
  PreSignOperation,
} from "./types";
import { EncodedAsset } from "./asset";
import { CompressedStealthAddress } from "../crypto";

const OPERATION_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "Operation(JoinSplit[] joinSplits,CompressedStealthAddress refundAddr,EncodedAsset[] encodedRefundAssets,Action[] actions,EncodedAsset encodedGasAsset,uint256 gasAssetRefundThreshold,uint256 executionGasLimit,uint256 maxNumRefunds,uint256 gasPrice,uint256 chainId,uint256 deadline,bool atomicActions)Action(address contractAddress,bytes encodedFunction)CompressedStealthAddress(uint256 h1,uint256 h2)EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)",
  ]
);

const COMPRESSED_STEALTH_ADDRESS_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["CompressedStealthAddress(uint256 h1,uint256 h2)"]
);

const ACTION_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["Action(address contractAddress,bytes encodedFunction)"]
);

const EIP712_JOINSPLIT_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)",
  ]
);

const ENCODED_ASSET_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"]
);

const ENCRYPTED_NOTE_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)"]
);

export function hashOperationRequest(operation: PreSignOperation): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          OPERATION_TYPEHASH,
          hashJoinSplits(operation.joinSplits),
          hashCompressedStealthAddress(operation.refundAddr),
          hashEncodedRefundAssets(operation.encodedRefundAssets),
          hashActions(operation.actions),
          hashEncodedAsset(operation.encodedGasAsset),
          operation.gasAssetRefundThreshold,
          operation.executionGasLimit,
          operation.maxNumRefunds,
          operation.gasPrice,
          operation.chainId,
          operation.deadline,
          operation.atomicActions,
        ]
      ),
    ]
  );
}

function hashJoinSplits(joinSplits: PreSignJoinSplit[]): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32[]"],
        [joinSplits.map((joinSplit) => hashJoinSplit(joinSplit))]
      ),
    ]
  );
}

function hashJoinSplit(joinSplit: PreSignJoinSplit): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          EIP712_JOINSPLIT_TYPEHASH,
          joinSplit.commitmentTreeRoot,
          joinSplit.nullifierA,
          joinSplit.nullifierB,
          joinSplit.newNoteACommitment,
          joinSplit.newNoteBCommitment,
          joinSplit.senderCommitment,
          hashEncodedAsset(joinSplit.encodedAsset),
          joinSplit.publicSpend,
          hashEncryptedNote(joinSplit.newNoteAEncrypted),
          hashEncryptedNote(joinSplit.newNoteBEncrypted),
        ]
      ),
    ]
  );
}

function hashActions(actions: Action[]): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32[]"],
        [actions.map((action) => hashAction(action))]
      ),
    ]
  );
}

function hashAction(action: Action): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bytes32"],
        [
          ACTION_TYPEHASH,
          action.contractAddress,
          ethers.utils.solidityKeccak256(["bytes"], [action.encodedFunction]),
        ]
      ),
    ]
  );
}

function hashCompressedStealthAddress(
  stealthAddress: CompressedStealthAddress
): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "uint256", "uint256"],
        [
          COMPRESSED_STEALTH_ADDRESS_TYPEHASH,
          stealthAddress.h1,
          stealthAddress.h2,
        ]
      ),
    ]
  );
}

function hashEncodedRefundAssets(encodedRefundAssets: EncodedAsset[]): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32[]"],
        [
          encodedRefundAssets.map((encodedAsset) =>
            hashEncodedAsset(encodedAsset)
          ),
        ]
      ),
    ]
  );
}

function hashEncodedAsset(encodedAsset: EncodedAsset): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "uint256", "uint256"],
        [
          ENCODED_ASSET_TYPEHASH,
          encodedAsset.encodedAssetAddr,
          encodedAsset.encodedAssetId,
        ]
      ),
    ]
  );
}

function hashEncryptedNote(encryptedNote: EncryptedNote): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "bytes32"],
        [
          ENCRYPTED_NOTE_TYPEHASH,
          ethers.utils.solidityKeccak256(
            ["bytes"],
            [encryptedNote.ciphertextBytes]
          ),
          ethers.utils.solidityKeccak256(
            ["bytes"],
            [encryptedNote.encapsulatedSecretBytes]
          ),
        ]
      ),
    ]
  );
}
