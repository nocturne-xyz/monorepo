import {
  Action,
  BN254_SCALAR_FIELD_MODULUS,
  BaseJoinSplit,
  BasicOperation,
  EncryptedNote,
  PreSignOperation,
  ProvenOperation,
  SignedOperation,
} from "./types";
import { EncodedAsset } from "./asset";
import { CompressedStealthAddress } from "../crypto";
import { solidityPackedKeccak256, solidityPacked, AbiCoder } from "ethers";

const OPERATION_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  [
    "EIP712Operation(JoinSplit[] joinSplits,CompressedStealthAddress refundAddr,EncodedAsset[] encodedRefundAssets,Action[] actions,EncodedAsset encodedGasAsset,uint256 gasAssetRefundThreshold,uint256 executionGasLimit,uint256 maxNumRefunds,uint256 gasPrice,uint256 chainId,uint256 deadline,bool atomicActions)Action(address contractAddress,bytes encodedFunction)CompressedStealthAddress(uint256 h1,uint256 h2)EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)",
  ]
);

const COMPRESSED_STEALTH_ADDRESS_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  ["CompressedStealthAddress(uint256 h1,uint256 h2)"]
);

const ACTION_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  ["Action(address contractAddress,bytes encodedFunction)"]
);

const EIP712_JOINSPLIT_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  [
    "EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)",
  ]
);

const ENCODED_ASSET_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  ["EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"]
);

const ENCRYPTED_NOTE_TYPEHASH = solidityPackedKeccak256(
  ["string"],
  ["EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)"]
);

export function computeOperationDigest(
  operation:
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): bigint {
  const operationHash = hashOperation(operation);
  return BigInt(operationHash) % BN254_SCALAR_FIELD_MODULUS;
}

export function hashOperation(
  operation:
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): string {
  return solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
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
          operation.atomicActions ? 1 : 0,
        ]
      ),
    ]
  );
}

function hashJoinSplits(joinSplits: BaseJoinSplit[]): string {
  let joinSplitHashes = [] as any;
  for (const joinSplit of joinSplits) {
    joinSplitHashes.push(hashJoinSplit(joinSplit));
  }

  const hash = solidityPackedKeccak256(
    ["bytes"],
    [solidityPacked(["bytes32[]"], [joinSplitHashes])]
  );

  console.log("joinSplits array hash", hash);
  return hash;
}

function hashJoinSplit(joinSplit: BaseJoinSplit): string {
  const hash = solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
        [
          "bytes32",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "bytes32",
          "uint256",
          "bytes32",
          "bytes32",
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

  console.log("joinSplit hash", hash);
  return hash;
}

function hashActions(actions: Action[]): string {
  let actionHashes = [] as any;
  for (const action of actions) {
    actionHashes.push(hashAction(action));
  }

  const hash = solidityPackedKeccak256(
    ["bytes"],
    [solidityPacked(["bytes32[]"], [actionHashes])]
  );

  console.log("actions array hash", hash);
  return hash;
}

function hashAction(action: Action): string {
  const encodedFunctionHash = solidityPackedKeccak256(
    ["bytes"],
    [action.encodedFunction]
  );
  console.log("encodedFunction hash", encodedFunctionHash);

  const hash = solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
        ["bytes32", "address", "bytes32"],
        [ACTION_TYPEHASH, action.contractAddress, encodedFunctionHash]
      ),
    ]
  );

  console.log("action hash", hash);
  return hash;
}

function hashCompressedStealthAddress(
  stealthAddress: CompressedStealthAddress
): string {
  return solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
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
  let assetHashes = [] as any;
  for (const encodedAsset of encodedRefundAssets) {
    assetHashes.push(hashEncodedAsset(encodedAsset));
  }

  const hash = solidityPackedKeccak256(
    ["bytes"],
    [solidityPacked(["bytes32[]"], [assetHashes])]
  );

  console.log("encodedRefundAssets array hash", hash);
  return hash;
}

function hashEncodedAsset(encodedAsset: EncodedAsset): string {
  return solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
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
  return solidityPackedKeccak256(
    ["bytes"],
    [
      new AbiCoder().encode(
        ["bytes32", "bytes32", "bytes32"],
        [
          ENCRYPTED_NOTE_TYPEHASH,
          solidityPackedKeccak256(["bytes"], [encryptedNote.ciphertextBytes]),
          solidityPackedKeccak256(
            ["bytes"],
            [encryptedNote.encapsulatedSecretBytes]
          ),
        ]
      ),
    ]
  );
}
