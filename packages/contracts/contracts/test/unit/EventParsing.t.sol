// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";

import "../../libs/Types.sol";
import {NocturneUtils} from "../utils/NocturneUtils.sol";
import {EventParsing} from "../utils/EventParsing.sol";

contract EventParsingTest is Test {
    event DepositInstantiated(
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    function testDecodeDepositRequestFromEvent() public {
        vm.recordLogs();
        emit DepositInstantiated(
            address(0x1),
            EncodedAsset({encodedAssetAddr: 1, encodedAssetId: 2}),
            3,
            NocturneUtils.defaultStealthAddress(),
            4,
            5
        );

        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory entry = entries[entries.length - 1];
        DepositRequest memory req = EventParsing.decodeDepositRequestFromEvent(
            entry
        );

        assertEq(req.spender, address(0x1));
        assertEq(req.encodedAsset.encodedAssetAddr, 1);
        assertEq(req.encodedAsset.encodedAssetId, 2);
        assertEq(req.value, 3);
        assertEq(
            req.depositAddr.h1X,
            NocturneUtils.defaultStealthAddress().h1X
        );
        assertEq(
            req.depositAddr.h1Y,
            NocturneUtils.defaultStealthAddress().h1Y
        );
        assertEq(
            req.depositAddr.h2X,
            NocturneUtils.defaultStealthAddress().h2X
        );
        assertEq(
            req.depositAddr.h2Y,
            NocturneUtils.defaultStealthAddress().h2Y
        );
        assertEq(req.nonce, 4);
        assertEq(req.gasCompensation, 5);
    }
}
