//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "../../libs/Types.sol";
import {DepositManager} from "../../DepositManager.sol";

contract TestDepositManager is DepositManager {
    function computeDigest(
        DepositRequest calldata req
    ) public view returns (bytes32) {
        return _computeDigest(req);
    }

    function hashDepositRequest(
        DepositRequest calldata req
    ) public pure returns (bytes32) {
        return _hashDepositRequest(req);
    }

    function instantiateDepositRet(
        EncodedAsset calldata encodedAsset,
        uint256 value,
        StealthAddress calldata depositAddr
    ) public payable returns (DepositRequest memory) {
        DepositRequest memory req = DepositRequest({
            spender: msg.sender,
            encodedAsset: encodedAsset,
            value: value,
            depositAddr: depositAddr,
            nonce: _nonces[msg.sender],
            gasCompensation: msg.value
        });

        this.instantiateDeposit(encodedAsset, value, depositAddr);

        return req;
    }
}
