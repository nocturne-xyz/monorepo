import { ethers } from "ethers";
import { DepositRequest } from "./types";
import { EncodedAsset } from "./asset";
import { CompressedStealthAddress } from "../crypto";

// TODO: replace with _TypedDataEncoder builtins
const DEPOSIT_REQUEST_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "DepositRequest(address spender,EncodedAsset encodedAsset,uint256 value,CompressedStealthAddress depositAddr,uint256 nonce,uint256 gasCompensation)CompressedStealthAddress(uint256 h1,uint256 h2)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)",
  ]
);

const ENCODED_ASSET_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"]
);

const COMPRESSED_STEALTH_ADDRESS_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["CompressedStealthAddress(uint256 h1,uint256 h2)"]
);

export function hashDepositRequest(req: DepositRequest): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "address",
          "bytes32",
          "uint256",
          "bytes32",
          "uint256",
          "uint256",
        ],
        [
          DEPOSIT_REQUEST_TYPEHASH,
          req.spender,
          hashEncodedAsset(req.encodedAsset),
          req.value,
          hashCompressedStealthAddress(req.depositAddr),
          req.nonce,
          req.gasCompensation,
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
