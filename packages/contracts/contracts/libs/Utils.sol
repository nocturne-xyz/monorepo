// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;
import {IWallet} from "../interfaces/IWallet.sol";
import {Groth16} from "../libs/Groth16.sol";
import {Pairing} from "../libs/Pairing.sol";
import "../libs/types.sol";

// helpers for converting to/from field elems, uint256s, and/or bytes, and hashing them
library Utils {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // hash array of field elements / uint256s as big-endian bytes with sha256
    function sha256FieldElems(
        uint256[] memory elems
    ) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(elems));
    }

    // split a uint256 into 2 limbs, one containing the high (256 - lowerBits) bits, the other containing the lower `lowerBits` bits
    function splitUint256ToLimbs(
        uint256 n,
        uint256 lowerBits
    ) internal pure returns (uint256, uint256) {
        uint256 hi = n >> lowerBits;
        uint256 lo = n & ((1 << lowerBits) - 1);
        return (hi, lo);
    }

    // return uint256 as two limbs - one uint256 containing the 3 hi bits, the other containing the lower 253 bits
    function uint256ToFieldElemLimbs(
        uint256 n
    ) internal pure returns (uint256, uint256) {
        return splitUint256ToLimbs(n, 253);
    }

    function sha256Note(
        EncodedNote memory note
    ) internal pure returns (uint256) {
        uint256[] memory elems = new uint256[](6);
        elems[0] = note.ownerH1;
        elems[1] = note.ownerH2;
        elems[2] = note.nonce;
        elems[3] = note.encodedAddr;
        elems[4] = note.encodedId;
        elems[5] = note.value;
        return uint256(sha256FieldElems(elems));
    }

    function proof8ToStruct(
        uint256[8] memory proof
    ) internal pure returns (Groth16.Proof memory) {
        return
            Groth16.Proof(
                Pairing.G1Point(proof[0], proof[1]),
                Pairing.G2Point([proof[2], proof[3]], [proof[4], proof[5]]),
                Pairing.G1Point(proof[6], proof[7])
            );
    }

    function _decodeAsset(
        EncodedAsset memory encodedAsset
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        return _decodeAsset(encodedAsset.encodedAddr, encodedAsset.encodedId);
    }

    function _decodeAsset(
        uint256 encodedAddr,
        uint256 encodedId
    )
        internal
        pure
        returns (AssetType assetType, address assetAddr, uint256 id)
    {
        id = (encodedAddr & (7 << 250)) | encodedId;
        assetAddr = address(uint160((encodedAddr << 96) >> 96));
        uint256 asset_type_bits = (encodedAddr >> 160) & 3;
        require(asset_type_bits <= 3, "Invalid encodedAddr field.");
        if (asset_type_bits == 0) {
            assetType = AssetType.ERC20;
        } else if (asset_type_bits == 1) {
            assetType = AssetType.ERC721;
        } else if (asset_type_bits == 2) {
            assetType = AssetType.ERC1155;
        }
        return (assetType, assetAddr, id);
    }

    function _encodeAssetToTuple(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (uint256 encodedAddr, uint256 encodedId) {
        encodedId = (id << 3) >> 3;
        uint256 asset_type_bits;
        if (assetType == AssetType.ERC20) {
            asset_type_bits = uint256(0);
        } else if (assetType == AssetType.ERC721) {
            asset_type_bits = uint256(1);
        } else if (assetType == AssetType.ERC1155) {
            asset_type_bits = uint256(2);
        }
        encodedAddr =
            ((id >> 253) << 253) |
            uint256(uint160(assetAddr)) |
            (asset_type_bits << 160);
        return (encodedAddr, encodedId);
    }

    function _encodeAsset(
        AssetType assetType,
        address assetAddr,
        uint256 id
    ) internal pure returns (EncodedAsset memory encodedAsset) {
        (uint256 encodedAddr, uint256 encodedId) = _encodeAssetToTuple(
            assetType,
            assetAddr,
            id
        );
        return EncodedAsset({encodedAddr: encodedAddr, encodedId: encodedId});
    }

    function _checkEqual(
        EncodedAsset memory assetA,
        EncodedAsset memory assetB
    ) internal pure returns (bool) {
        return (assetA.encodedAddr == assetB.encodedAddr &&
            assetA.encodedId == assetB.encodedId);
    }
}
