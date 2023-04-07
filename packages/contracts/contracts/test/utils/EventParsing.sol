//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "../../libs/Types.sol";
import "forge-std/Vm.sol";

library EventParsing {
    function decodeDepositRequestFromEvent(
        Vm.Log memory entry
    ) public pure returns (DepositRequest memory) {
        address spender = address(uint160(uint256(entry.topics[1])));
        (
            uint256 encodedAssetAddr,
            uint256 encodedAssetId,
            uint256 value,
            uint256 h1X,
            uint256 h1Y,
            uint256 h2X,
            uint256 h2Y,
            uint256 nonce,
            uint256 gasCompensation
        ) = abi.decode(
                entry.data,
                (
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256,
                    uint256
                )
            );

        return
            DepositRequest({
                spender: spender,
                encodedAsset: EncodedAsset({
                    encodedAssetAddr: encodedAssetAddr,
                    encodedAssetId: encodedAssetId
                }),
                value: value,
                depositAddr: StealthAddress({
                    h1X: h1X,
                    h1Y: h1Y,
                    h2X: h2X,
                    h2Y: h2Y
                }),
                nonce: nonce,
                gasCompensation: gasCompensation
            });
    }
}
