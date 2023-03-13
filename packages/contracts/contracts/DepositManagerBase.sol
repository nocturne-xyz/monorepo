// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./libs/Types.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

// import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

abstract contract DepositManagerBase {
    uint256 public CHAIN_ID;
    string public CONTRACT_NAME;
    string public CONTRACT_VERSION;

    bytes32 constant EIP712DOMAIN_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            )
        );

    bytes32 public constant DEPOSIT_REQUEST_TYPEHASH =
        keccak256(
            bytes(
                // solhint-disable-next-line max-line-length
                "DepositRequest(uint256 chainId,address spender,EncodedAsset encodedAsset,uint256 value,StealthAddress depositAddr,uint256 nonce,uint256 gasPrice)EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
            )
        );

    bytes32 public constant ENCODED_ASSET_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "EncodedAsset(uint256 encodedAssetAddr,uint256 encodedAssetId)"
        );

    bytes32 public constant STEALTH_ADDRESS_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "StealthAddress(uint256 h1X,uint256 h1Y,uint256 h2X,uint256 h2Y)"
        );

    constructor(
        uint256 chainId,
        string memory contractName,
        string memory contractVersion
    ) {
        CHAIN_ID = chainId;
        CONTRACT_NAME = contractName;
        CONTRACT_VERSION = contractVersion;
    }

    function _getDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(CONTRACT_NAME)),
                    keccak256(bytes(CONTRACT_VERSION)),
                    bytes32(CHAIN_ID),
                    address(this)
                )
            );
    }

    function _recoverDepositRequestSig(
        DepositRequest calldata req,
        bytes calldata signature
    ) internal view returns (address) {
        bytes32 domainSeparator = _getDomainSeparator();
        bytes32 structHash = _hashDepositRequest(req);

        bytes32 digest = ECDSAUpgradeable.toTypedDataHash(
            domainSeparator,
            structHash
        );

        return ECDSAUpgradeable.recover(digest, signature);
    }

    function _hashDepositRequest(
        DepositRequest calldata req
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DEPOSIT_REQUEST_TYPEHASH,
                    req.chainId,
                    req.spender,
                    _hashEncodedAsset(req.encodedAsset),
                    req.value,
                    _hashStealthAddress(req.depositAddr),
                    req.nonce,
                    req.gasPrice
                )
            );
    }

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

    function _hashStealthAddress(
        StealthAddress calldata stealthAddress
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    STEALTH_ADDRESS_TYPEHASH,
                    stealthAddress.h1X,
                    stealthAddress.h1Y,
                    stealthAddress.h2X,
                    stealthAddress.h2Y
                )
            );
    }
}
