// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {JsonDecodings, SignedDepositRequestFixture} from "./utils/JsonDecodings.sol";
import {TestDepositManagerBase} from "./harnesses/TestDepositManagerBase.sol";

contract DepositManagerBaseTest is Test, ParseUtils, JsonDecodings {
    string constant SIGNED_DEPOSIT_REQ_FIXTURE_PATH =
        "/fixtures/signedDepositRequest.json";

    TestDepositManagerBase public depositManagerBase;

    function testVerifiesSignedDepositFixture() public {
        SignedDepositRequestFixture memory fixture = JsonDecodings
            .loadSignedDepositRequestFixture(SIGNED_DEPOSIT_REQ_FIXTURE_PATH);
        depositManagerBase = new TestDepositManagerBase(
            fixture.contractName,
            fixture.contractVersion
        );

        string memory sig = fixture.signedDepositRequest.screenerSig;
        console.logString(sig);

        address recovered = depositManagerBase.recoverDepositRequestSig(
            fixture.signedDepositRequest.depositRequest,
            bytes(
                "0xd26958669d49c619bcbac9fd8df5b8a4231a49eb3a12c3215045631cd9e5c19f77c43183e3b14cca921441934d4ead60b9ab9d67a76a37a551cb6b40df9ef7b21c"
            )
        );
        // assertEq(recovered, fixture.screenerAddress);
    }
}
