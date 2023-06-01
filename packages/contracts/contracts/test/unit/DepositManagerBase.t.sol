// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "../utils/ParseUtils.sol";
import {JsonDecodings, SignedDepositRequestFixture} from "../utils/JsonDecodings.sol";
import "../harnesses/TestDepositManagerBase.sol";

contract DepositManagerBaseTest is Test, JsonDecodings {
    string constant SIGNED_DEPOSIT_REQ_FIXTURE_PATH =
        "/fixtures/signedDepositRequest.json";

    TestDepositManagerBase public depositManagerBase;

    function testVerifiesSignedDepositFixture() public {
        SignedDepositRequestFixture memory fixture = JsonDecodings
            .loadSignedDepositRequestFixture(SIGNED_DEPOSIT_REQ_FIXTURE_PATH);

        depositManagerBase = new TestDepositManagerBase();
        depositManagerBase.initialize(
            fixture.contractName,
            fixture.contractVersion
        );

        // Override chainid, bytecode, and storage for fixture.contractAddress
        vm.chainId(fixture.chainId);
        vm.etch(fixture.contractAddress, address(depositManagerBase).code);
        vm.store(
            fixture.contractAddress,
            bytes32(uint256(1)),
            keccak256(bytes(fixture.contractName))
        );
        vm.store(
            fixture.contractAddress,
            bytes32(uint256(2)),
            keccak256(bytes(fixture.contractVersion))
        );

        address recovered = ITestDepositManagerBase(fixture.contractAddress)
            .recoverDepositRequestSigner(
                fixture.depositRequest,
                fixture.signature
            );
        
        bytes32 domainSeparator = ITestDepositManagerBase(
            fixture.contractAddress
        ).domainSeparatorV4();
        console.log("domain separator:");
        console.logBytes32(domainSeparator);

        bytes32 digest = ITestDepositManagerBase(fixture.contractAddress)
            .computeDigest(fixture.depositRequest);
        console.log("digest:");
        console.logBytes32(digest);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x1, digest);

        console.logBytes32(r);
        console.logBytes32(s);
        console.log("v", v);

        assertEq(recovered, fixture.screenerAddress);
    }

    function testDepositRequestHashMatchesOffchainImpl() public {
        SignedDepositRequestFixture memory fixture = JsonDecodings
            .loadSignedDepositRequestFixture(SIGNED_DEPOSIT_REQ_FIXTURE_PATH);

        depositManagerBase = new TestDepositManagerBase();
        depositManagerBase.initialize(
            fixture.contractName,
            fixture.contractVersion
        );

        bytes32 depositRequestHash = depositManagerBase.hashDepositRequest(
            fixture.depositRequest
        );

        assertEq(depositRequestHash, fixture.depositRequestHash);
    }
}
