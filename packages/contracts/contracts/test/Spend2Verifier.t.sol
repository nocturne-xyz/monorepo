// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "./utils/JsonDecodings.sol";
import {ISpend2Verifier} from "../interfaces/ISpend2Verifier.sol";
import {Spend2Verifier} from "../Spend2Verifier.sol";

contract TestSpend2Verifier is Test {
    using stdJson for string;

    string constant FIXTURE_PATH = "/fixtures/spend2Proof.json";

    ISpend2Verifier verifier;

    function loadFixture() public returns (string memory) {
        string memory root = vm.projectRoot();
        bytes memory path = abi.encodePacked(bytes(root), bytes(FIXTURE_PATH));
        return vm.readFile(string(path));
    }

    function setUp() public virtual {
        verifier = ISpend2Verifier(new Spend2Verifier());
    }

    function testVerifyFixture() public {
        string memory json = loadFixture();
        bytes memory proofBytes = json.parseRaw(".proof");
        bytes memory signalBytes = json.parseRaw(".publicSignals");
        BaseProof memory proof = abi.decode(proofBytes, (BaseProof));
        uint256[9] memory signals = abi.decode(signalBytes, (uint256[9]));

        bool v = verifier.verifyProof(
            [proof.pi_a[0], proof.pi_a[1]],
            [
                [proof.pi_b[0][0], proof.pi_b[1][0]],
                [proof.pi_b[0][1], proof.pi_b[1][1]]
            ],
            [proof.pi_c[0], proof.pi_c[1]],
            signals
        );
    }
}
