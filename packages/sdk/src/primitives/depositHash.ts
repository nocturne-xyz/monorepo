import { ethers } from "ethers";
import { DepositRequest } from "./types";
import { EncodedAsset } from "./asset";
import { CompressedStealthAddress } from "../crypto";

const DEPOSIT_REQUEST_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "DepositRequest(address spender,EncodedAsset encodedAsset,uint256 value,StealthAddress depositAddr,uint256 nonce,uint256 gasCompensation)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)CompressedStealthAddress(uint256 h1,uint256 h2)",
  ]
);

const ENCODED_ASSET_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"]
);

const STEALTH_ADDRESS_TYPEHASH = ethers.utils.solidityKeccak256(
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
          hashStealthAddress(req.depositAddr),
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

function hashStealthAddress(stealthAddress: CompressedStealthAddress): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "uint256", "uint256"],
        [STEALTH_ADDRESS_TYPEHASH, stealthAddress.h1, stealthAddress.h2]
      ),
    ]
  );
}
