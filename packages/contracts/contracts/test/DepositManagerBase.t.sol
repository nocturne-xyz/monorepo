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
            fixture.signedDepositRequest.depositRequest.chainId,
            fixture.contractName,
            fixture.contractVersion
        );

        bytes32 domainSeparator = depositManagerBase.getDomainSeparator();
        console.log("Domain separator:");
        console.logBytes32(domainSeparator);

        bytes32 digest = depositManagerBase.getDigest(
            fixture.signedDepositRequest.depositRequest
        );
        console.log("Digest:");
        console.logBytes32(digest);

        console.log("TEST -- chainId:", depositManagerBase.CHAIN_ID());
        console.log(
            "TEST -- contractName:",
            depositManagerBase.CONTRACT_NAME()
        );
        console.log(
            "TEST -- contractVersion:",
            depositManagerBase.CONTRACT_VERSION()
        );

        bytes memory sig = rsvToSignatureBytes(
            0xc300cd749eeee61cb410611702941891a839b6a98d4169b47d9be9d765c99292,
            0x648a99880671daf805ab50a81da6559ec66170ab5ce42dea52003d74016ce99b,
            0x1c
        );

        address recovered = depositManagerBase
            .recoverDepositRequestSigWithMockedAddress(
                fixture.contractAddress,
                fixture.signedDepositRequest.depositRequest,
                sig
            );

        console.log("recovered:", recovered);

        assertEq(recovered, fixture.screenerAddress);
    }

    function testECRecover() public {
        address recovered = ECDSAUpgradeable.recover(
            0x93afb89179ea313da1d5eb78ffc75b68f53c79f44b76386affef903bbfe1b329, // messageHash
            0x1c, // v
            0xc300cd749eeee61cb410611702941891a839b6a98d4169b47d9be9d765c99292, // r
            0x648a99880671daf805ab50a81da6559ec66170ab5ce42dea52003d74016ce99b // s
        );

        console.log("ECRecover:", recovered);
    }

    function testNormalRecover() public {
        bytes memory sig = rsvToSignatureBytes(
            0xc300cd749eeee61cb410611702941891a839b6a98d4169b47d9be9d765c99292,
            0x648a99880671daf805ab50a81da6559ec66170ab5ce42dea52003d74016ce99b,
            0x1c
        );

        address recovered = ECDSAUpgradeable.recover(
            0x93afb89179ea313da1d5eb78ffc75b68f53c79f44b76386affef903bbfe1b329,
            sig
        );
        console.log("Concat Recovered:", recovered);
    }
}
