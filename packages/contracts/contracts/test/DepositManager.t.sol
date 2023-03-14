// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import {TestDepositManager} from "./harnesses/TestDepositManager.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";

contract DepositManagerTest is Test {
    Wallet public wallet;
    Vault public vault;
    TestDepositManager public depositManager;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    function setUp() public virtual {
        // TODO: extract wallet/vault deployment into NocturneUtils
        vault = new Vault();
        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        wallet = new Wallet();
        wallet.initialize(
            address(vault),
            address(joinSplitVerifier),
            address(subtreeUpdateVerifier)
        );

        vault.initialize(address(wallet));

        depositManager = new TestDepositManager();
        depositManager.initialize(
            CONTRACT_NAME,
            CONTRACT_VERSION,
            address(wallet),
            address(vault)
        );
    }

    // function test

    // TODO: test deposit successfully goes through
}
