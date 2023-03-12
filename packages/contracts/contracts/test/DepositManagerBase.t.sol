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

        depositManagerBase = new TestDepositManagerBase(
            fixture.depositRequest.chainId,
            fixture.contractName,
            fixture.contractVersion
        );

        address recovered = depositManagerBase
            .recoverDepositRequestSigWithMockedAddress(
                fixture.contractAddress,
                fixture.depositRequest,
                fixture.signature
            );

        assertEq(recovered, fixture.screenerAddress);
    }
}
