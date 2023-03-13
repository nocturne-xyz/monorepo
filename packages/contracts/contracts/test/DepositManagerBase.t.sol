// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {JsonDecodings, SignedDepositRequestFixture} from "./utils/JsonDecodings.sol";
import "./harnesses/TestDepositManagerBase.sol";

contract DepositManagerBaseTest is Test, ParseUtils, JsonDecodings {
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
        vm.chainId(fixture.depositRequest.chainId);
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
            .recoverDepositRequestSig(
                fixture.depositRequest,
                fixture.signature
            );

        assertEq(recovered, fixture.screenerAddress);
    }
}
