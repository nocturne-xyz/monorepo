// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import "../harnesses/TestCanonAddrRegistryEntryEIP712.sol";
import "../../libs/Types.sol";

contract CanonAddrRegistryEntryEIP712Test is Test {
    TestCanonAddrRegistryEntryEIP712 public entryEip712;

    function testEntryHashMatchesOffchainImpl() public {
        // NOTE: reference core/scripts/genCanonAddrRegistryEntryHashTestCase.ts for inputs/expected outputs
        entryEip712 = new TestCanonAddrRegistryEntryEIP712();
        entryEip712.initialize("NocturneCanonicalAddressRegistry", "v1");

        CanonAddrRegistryEntry memory entry = CanonAddrRegistryEntry({
            ethAddress: address(0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4),
            perCanonAddrNonce: 1
        });

        bytes32 entryHash = entryEip712.hashCanonAddrRegistryEntry(entry);
        console.log("entryHash:");
        console.logBytes32(entryHash);
        console.log("");

        // Entry hash generated by running test case gen script in core
        assertEq(
            entryHash,
            bytes32(
                0x7055b2b569bf9e4db9211fb121d28388ffed4fa2a6d71649b0bd0c50f59d2c60
            )
        );

        vm.chainId(1);
        vm.etch(
            address(0x1111111111111111111111111111111111111111),
            address(entryEip712).code
        );
        vm.store(
            address(0x1111111111111111111111111111111111111111),
            bytes32(uint256(1)),
            keccak256(bytes("NocturneCanonicalAddressRegistry"))
        );
        vm.store(
            address(0x1111111111111111111111111111111111111111),
            bytes32(uint256(2)),
            keccak256(bytes("v1"))
        );

        uint256 entryDigest = ITestCanonAddrRegistryEntryEIP712(
            address(0x1111111111111111111111111111111111111111)
        ).computeDigest(entry);

        console.log("entryDigest:");
        console.logBytes32(bytes32(entryDigest));
        console.log("");

        // Entry digest generated by running test case gen script in core
        assertEq(
            entryDigest,
            uint256(
                0x5B79549489E20D9F9CC4D940DF00F0369250A97331C05330D5F0150394E94DE
            )
        );
    }
}
