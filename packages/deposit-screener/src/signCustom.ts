/*
const createForwardRequestParams = async () => {
  const wallet = Wallet.createRandom();
  const sponsor = await wallet.getAddress();

  console.log(`Mock PK: ${await wallet._signingKey().privateKey}`);
  console.log(`Mock wallet address: ${sponsor}`);
  // abi encode for HelloWorld.sayHiVanilla(address _feeToken) (see 0x61bBe925A5D646cE074369A6335e5095Ea7abB7A on Kovan)
  const data = `0x4b327067000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeaeeeeeeeeeeeeeeeee`;

  const req: ForwardRequest = {
    chainId,
    target: HELLO_WORLD,
    data,
    feeToken: NATIVE_TOKEN,
    paymentType: 1,
    maxFee: "10000000000000000000",
    gas: GAS,
    sponsor,
    sponsorChainId: chainId,
    nonce: 0,
    enforceSponsorNonce: false,
    enforceSponsorNonceOrdering: false,
  };

  console.log(`ForwardRequest: ${JSON.stringify(req)}`);

  const abiCoder = new utils.AbiCoder();

  // compute EIP-712 domain separator
  const domainSeparator = utils.solidityKeccak256(
    ["bytes"],
    [
      abiCoder.encode(
        ["bytes32", "bytes32", "bytes32", "bytes32", "address"],
        [
          utils.solidityKeccak256(
            ["bytes"],
            [
              utils.toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
              ),
            ]
          ),
          utils.solidityKeccak256(
            ["bytes"],
            [utils.toUtf8Bytes("GelatoRelayForwarder")]
          ),
          utils.solidityKeccak256(["bytes"], [utils.toUtf8Bytes("V1")]),
          utils.hexZeroPad(utils.hexlify(chainId), 32),
          utils.getAddress(gelatoRelayForwarder),
        ]
      ),
    ]
  );
  console.log(`domainSeparator: ${domainSeparator}`);
  // keccak256 hash of ForwardRequest struct's stringified format
  const requestTypeHash = utils.solidityKeccak256(
    ["string"],
    [
      "ForwardRequest(uint256 chainId,address target,bytes data,address feeToken,uint256 paymentType,uint256 maxFee,uint256 gas,address sponsor,uint256 sponsorChainId,uint256 nonce,bool enforceSponsorNonce,bool enforceSponsorNonceOrdering)",
    ]
  );

  const hash = utils.solidityKeccak256(
    ["bytes"],
    [
      abiCoder.encode(
        [
          "bytes32",
          "uint256",
          "address",
          "bytes32",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "address",
          "uint256",
          "uint256",
          "bool",
          "bool",
        ],
        [
          requestTypeHash,
          req.chainId,
          req.target,
          utils.solidityKeccak256(["bytes"], [req.data]),
          req.feeToken,
          req.paymentType,
          req.maxFee,
          req.gas,
          req.sponsor,
          req.sponsorChainId,
          req.nonce,
          req.enforceSponsorNonce,
          req.enforceSponsorNonceOrdering,
        ]
      ),
    ]
  );
  // hash to be signed by sponsor
  const digest = utils.solidityKeccak256(
    ["bytes"],
    [utils.hexConcat(["0x1901", domainSeparator, hash])]
  );
  // sponsor signature
  const sponsorSignature: utils.BytesLike = utils.joinSignature(
    await wallet._signingKey().signDigest(digest)
  );
  console.log(`sponsorSignature: ${sponsorSignature}`);
  // API payload to be submitted to Gelato Relay API
  const reqParams: ForwardRequestParams = {
    typeId: "ForwardRequest",
    ...req,
    sponsorSignature,
  };

  return reqParams;

*/

import { DepositRequest, SignedDepositRequest } from "@nocturne-xyz/sdk";
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
    "DepositRequest(uint256 chainId,address spender,uint256 encodedAssetAddr,uint256 encodedAssetId,uint256 value,uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y,uint256 nonce,uint256 gasPrice)",
  ]
);

export async function signDepositRequest(
  wallet: ethers.Wallet,
  domain: EIP712Domain,
  depositRequest: DepositRequest
): Promise<SignedDepositRequest> {
  const domainSeparator = computeDomainSeparator(domain);
  const hashedDepositRequest = hashDepositRequest(depositRequest);
  const digest = ethers.utils.solidityKeccak256(
    ["bytes"],
    [ethers.utils.hexConcat(["0x1901", domainSeparator, hashedDepositRequest])]
  );

  console.log("Digest:", digest);

  const signature: ethers.utils.BytesLike = ethers.utils.joinSignature(
    wallet._signingKey().signDigest(digest)
  );

  return { depositRequest, screenerSig: signature };
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
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          DEPOSIT_REQUEST_TYPEHASH,
          req.chainId,
          req.spender,
          req.encodedAssetAddr,
          req.encodedAssetId,
          req.value,
          req.h1X,
          req.h1Y,
          req.h2X,
          req.h2Y,
          req.nonce,
          req.gasPrice,
        ]
      ),
    ]
  );
}
