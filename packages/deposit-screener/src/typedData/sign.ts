import {
  CompressedStealthAddress,
  DepositRequest,
  EncodedAsset,
} from "@nocturne-xyz/sdk";
import { ethers } from "ethers";

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
}

const EIP712_DOMAIN_TYPEHASH = ethers.utils.solidityKeccak256(
  ["bytes"],
  [
    ethers.utils.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    ),
  ]
);

const DEPOSIT_REQUEST_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  [
    "DepositRequest(address spender,EncodedAsset encodedAsset,uint256 value,CompressedStealthAddress depositAddr,uint256 nonce,uint256 gasCompensation)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)CompressedStealthAddress(uint256 h1,uint256 h2)",
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

export async function signDepositRequest(
  wallet: ethers.Wallet,
  domain: EIP712Domain,
  depositRequest: DepositRequest
): Promise<string> {
  const domainSeparator = computeDomainSeparator(domain);
  const hashedDepositRequest = hashDepositRequestCustom(depositRequest);
  const digest = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.hexConcat(["0x1901", domainSeparator, hashedDepositRequest])]
  );

  return ethers.utils.joinSignature(wallet._signingKey().signDigest(digest));
}

function computeDomainSeparator(domain: EIP712Domain): string {
  // compute EIP-712 domain separator
  const domainSeparator = ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "bytes32", "bytes32", "address"],
        [
          EIP712_DOMAIN_TYPEHASH,
          ethers.utils.solidityKeccak256(
            ["bytes"],
            [ethers.utils.toUtf8Bytes(domain.name)]
          ),
          ethers.utils.solidityKeccak256(
            ["bytes"],
            [ethers.utils.toUtf8Bytes(domain.version)]
          ),
          ethers.utils.hexZeroPad(ethers.utils.hexlify(domain.chainId), 32),
          ethers.utils.getAddress(domain.verifyingContract),
        ]
      ),
    ]
  );
  return domainSeparator;
}

export function hashDepositRequestCustom(req: DepositRequest): string {
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
