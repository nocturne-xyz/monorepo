//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "../../libs/Types.sol";
import {TellerBase} from "../../TellerBase.sol";

contract TestTellerBase is TellerBase {
    function initialize(
        string memory contractName,
        string memory contractVersion
    ) external initializer {
        __TellerBase_init(contractName, contractVersion);
    }

    // function recoverOperationSigner(
    //     EIP712Operation calldata op,
    //     bytes calldata signature
    // ) external view override returns (address) {
    //     return _recoverOperationSigner(op, signature);
    // }

    function computeDigest(
        EIP712Operation calldata op
    ) external view returns (bytes32) {
        return _computeDigest(op);
    }

    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function hashOperation(
        EIP712Operation calldata op
    ) public pure returns (bytes32) {
        return _hashOperation(op);
    }

    function hashJoinSplits(
        EIP712JoinSplit[] calldata joinSplits
    ) public pure returns (bytes32) {
        return _hashJoinSplits(joinSplits);
    }

    function hashJoinSplit(
        EIP712JoinSplit calldata joinSplit
    ) public pure returns (bytes32) {
        return _hashJoinSplit(joinSplit);
    }

    function hashActions(
        Action[] calldata actions
    ) public pure returns (bytes32) {
        return _hashActions(actions);
    }

    function hashAction(Action calldata action) public pure returns (bytes32) {
        return _hashAction(action);
    }

    function hashCompressedStealthAddress(
        CompressedStealthAddress calldata compressedStealthAddress
    ) public pure returns (bytes32) {
        return _hashCompressedStealthAddress(compressedStealthAddress);
    }

    function hashEncodedFunction(
        bytes calldata encodedFunction
    ) public pure returns (bytes32) {
        return keccak256(encodedFunction);
    }

    function hashEncodedRefundAssets(
        EncodedAsset[] calldata encodedRefundAssets
    ) public pure returns (bytes32) {
        return _hashEncodedRefundAssets(encodedRefundAssets);
    }

    function hashEncodedAsset(
        EncodedAsset calldata encodedAsset
    ) public pure returns (bytes32) {
        return _hashEncodedAsset(encodedAsset);
    }

    function nameHash() public view returns (bytes32) {
        return _EIP712NameHash();
    }

    function versionHash() public view returns (bytes32) {
        return _EIP712VersionHash();
    }
}
