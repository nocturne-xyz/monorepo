import {
  DepositRequest,
  EncodedAsset,
  StealthAddress,
} from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import { EIP712Domain } from "./typedData";

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
    "DepositRequest(uint256 chainId,address spender,EncodedAsset encodedAsset,uint256 value,StealthAddress depositAddr,uint256 nonce,uint256 gasPrice)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)",
  ]
);

const ENCODED_ASSET_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"]
);

const STEALTH_ADDRESS_TYPEHASH = ethers.utils.solidityKeccak256(
  ["string"],
  ["StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"]
);

export async function signDepositRequest(
  wallet: ethers.Wallet,
  domain: EIP712Domain,
  depositRequest: DepositRequest
): Promise<string> {
  const domainSeparator = computeDomainSeparator(domain);
  const hashedDepositRequest = hashDepositRequest(depositRequest);
  const digest = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.hexConcat(["0x1901", domainSeparator, hashedDepositRequest])]
  );

  console.log("Digest:", digest);

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
  console.log(`domainSeparator: ${domainSeparator}`);
  return domainSeparator;
}

function hashDepositRequest(req: DepositRequest): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "uint256",
          "address",
          "bytes32",
          "uint256",
          "bytes32",
          "uint256",
          "uint256",
        ],
        [
          DEPOSIT_REQUEST_TYPEHASH,
          req.chainId,
          req.spender,
          hashEncodedAsset(req.encodedAsset),
          req.value,
          hashStealthAddress(req.depositAddr),
          req.nonce,
          req.gasPrice,
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

function hashStealthAddress(stealthAddress: StealthAddress): string {
  return ethers.utils.solidityKeccak256(
    ["bytes"],
    [
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "uint256", "uint256", "uint256", "uint256"],
        [
          STEALTH_ADDRESS_TYPEHASH,
          stealthAddress.h1X,
          stealthAddress.h1Y,
          stealthAddress.h2X,
          stealthAddress.h2Y,
        ]
      ),
    ]
  );
}
