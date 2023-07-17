import {
  Action,
  // BN254_SCALAR_FIELD_MODULUS,
  BaseJoinSplit,
  BasicOperation,
  EncryptedNote,
  PreSignOperation,
  ProvenOperation,
  SignedOperation,
} from "./types";
import { EncodedAsset } from "./asset";
import { CompressedStealthAddress } from "../crypto";
import { ethers, TypedDataDomain, TypedDataField } from "ethers";
const { _TypedDataEncoder } = ethers.utils;

export const TELLER_CONTRACT_NAME = "NocturneDepositManager";
export const TELLER_CONTRACT_VERSION = "v1";

export const OPERATION_TYPES = {
  EIP712Operation: [
    { name: "joinSplits", type: "EIP712JoinSplit[]" },
    { name: "refundAddr", type: "CompressedStealthAddress" },
    { name: "encodedRefundAssets", type: "EncodedAsset[]" },
    { name: "actions", type: "Action[]" },
    { name: "encodedGasAsset", type: "EncodedAsset" },
    { name: "gasAssetRefundThreshold", type: "uint256" },
    { name: "executionGasLimit", type: "uint256" },
    { name: "maxNumRefunds", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "atomicActions", type: "bool" },
  ],
  Action: [
    { name: "contractAddress", type: "address" },
    { name: "encodedFunction", type: "bytes" },
  ],
  CompressedStealthAddress: [
    { name: "h1", type: "uint256" },
    { name: "h2", type: "uint256" },
  ],
  EIP712JoinSplit: [
    { name: "commitmentTreeRoot", type: "uint256" },
    { name: "nullifierA", type: "uint256" },
    { name: "nullifierB", type: "uint256" },
    { name: "newNoteACommitment", type: "uint256" },
    { name: "newNoteBCommitment", type: "uint256" },
    { name: "senderCommitment", type: "uint256" },
    { name: "encodedAsset", type: "EncodedAsset" },
    { name: "publicSpend", type: "uint256" },
    { name: "newNoteAEncrypted", type: "EncryptedNote" },
    { name: "newNoteBEncrypted", type: "EncryptedNote" },
  ],
  EncodedAsset: [
    { name: "encodedAssetAddr", type: "uint256" },
    { name: "encodedAssetId", type: "uint256" },
  ],
  EncryptedNote: [
    { name: "ciphertextBytes", type: "bytes" },
    { name: "encapsulatedSecretBytes", type: "bytes" },
  ],
};

const OPERATION_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "EIP712Operation(EIP712JoinSplit[] joinSplits,CompressedStealthAddress refundAddr,EncodedAsset[] encodedRefundAssets,Action[] actions,EncodedAsset encodedGasAsset,uint256 gasAssetRefundThreshold,uint256 executionGasLimit,uint256 maxNumRefunds,uint256 gasPrice,uint256 chainId,uint256 deadline,bool atomicActions)Action(address contractAddress,bytes encodedFunction)CompressedStealthAddress(uint256 h1,uint256 h2)EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)",
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
    "EIP712JoinSplit(uint256 commitmentTreeRoot,uint256 nullifierA,uint256 nullifierB,uint256 newNoteACommitment,uint256 newNoteBCommitment,uint256 senderCommitment,EncodedAsset encodedAsset,uint256 publicSpend,EncryptedNote newNoteAEncrypted,EncryptedNote newNoteBEncrypted)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)EncryptedNote(bytes ciphertextBytes,bytes encapsulatedSecretBytes)",
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

function encodeType(name: string, fields: Array<TypedDataField>): string {
  return `${name}(${fields
    .map(({ name, type }) => type + " " + name)
    .join(",")})`;
}

export function computeOperationDigest(
  domain: TypedDataDomain,
  operation:
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): bigint {
  const hashedDomain = _TypedDataEncoder.hashDomain(domain);
  console.log("Domain:", domain);
  console.log("BULTIN Domain hash:", hashedDomain);

  // const encoder = _TypedDataEncoder.from(OPERATION_TYPES);
  // console.log(encoder);
  // console.log(encoder.encodeData("EIP712Operation", operation));

  const encodedType = encodeType(
    "EIP712Operation",
    OPERATION_TYPES.EIP712Operation
  );
  console.log("Encoded Type:", encodedType);

  const digest = _TypedDataEncoder.hash(domain, OPERATION_TYPES, operation);
  const opHash = _TypedDataEncoder.hashStruct(
    "EIP712Operation",
    OPERATION_TYPES,
    operation
  );
  console.log("BULTIN Operation hash:", opHash);

  const refundAddrHash = _TypedDataEncoder.hashStruct(
    "CompressedStealthAddress",
    OPERATION_TYPES,
    operation.refundAddr
  );
  console.log("BULTIN refundAddr hash:", refundAddrHash);

  const joinSplitsHash = _TypedDataEncoder.hashStruct(
    "EIP712JoinSplit[]",
    OPERATION_TYPES,
    operation.joinSplits
  );
  console.log("BULTIN joinSplits array hash:", joinSplitsHash);

  const joinSplitHash = _TypedDataEncoder.hashStruct(
    "EIP712JoinSplit",
    OPERATION_TYPES,
    operation.joinSplits[0]
  );
  console.log("BULTIN joinSplit hash:", joinSplitHash);

  const encodedRefundAssetsHash = _TypedDataEncoder.hashStruct(
    "EncodedAsset[]",
    OPERATION_TYPES,
    operation.encodedRefundAssets
  );
  console.log(
    "BULTIN encodedRefundAssets array hash:",
    encodedRefundAssetsHash
  );

  const actionsHash = _TypedDataEncoder.hashStruct(
    "Action[]",
    OPERATION_TYPES,
    operation.actions
  );
  console.log("BULTIN actions array hash:", actionsHash);

  const actionHashSingle = _TypedDataEncoder.hashStruct(
    "Action",
    OPERATION_TYPES,
    operation.actions[0]
  );
  console.log("BULTIN action hash (alone):", actionHashSingle);

  const hashActionHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(["bytes32[]"], [[actionHashSingle]])
  );
  console.log("Hash action hash:", hashActionHash);
  console.log("hash hash action hash:", ethers.utils.keccak256(hashActionHash));

  const gasAssetHash = _TypedDataEncoder.hashStruct(
    "EncodedAsset",
    OPERATION_TYPES,
    operation.encodedGasAsset
  );
  console.log("BULTIN encodedGasAsset hash:", gasAssetHash);

  console.log("Operation digest (pre-mod):", digest);
  // TODO: mod BN254
  return BigInt(digest);
}

export function hashOperation(
  operation:
    | BasicOperation
    | PreSignOperation
    | SignedOperation
    | ProvenOperation
): string {
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

  const hash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.solidityPack(["bytes32[]"], [joinSplitHashes])]
  );

  console.log("joinSplits array hash", hash);
  return hash;
}

function hashJoinSplit(joinSplit: BaseJoinSplit): string {
  const hash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
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
    console.log("action hash (alone):", action);
    actionHashes.push(hashAction(action));
  }

  const hash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.solidityPack(["bytes32[]"], [actionHashes])]
  );

  console.log("actions array hash", hash);
  return hash;
}

function hashAction(action: Action): string {
  const encodedFunctionHash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [action.encodedFunction]
  );
  console.log("encodedFunction hash", encodedFunctionHash);

  const hash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
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
  let assetHashes = [] as any;
  for (const encodedAsset of encodedRefundAssets) {
    assetHashes.push(hashEncodedAsset(encodedAsset));
  }

  const hash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.solidityPack(["bytes32[]"], [assetHashes])]
  );

  console.log("encodedRefundAssets array hash", hash);
  return hash;
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
