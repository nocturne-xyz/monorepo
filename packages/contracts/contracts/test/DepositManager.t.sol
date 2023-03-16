// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "../libs/Types.sol";
import {NocturneUtils} from "./utils/NocturneUtils.sol";
import {ParseUtils} from "./utils/ParseUtils.sol";
import {AssetUtils} from "../libs/AssetUtils.sol";
import {TestDepositManager} from "./harnesses/TestDepositManager.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "./tokens/SimpleERC1155Token.sol";

contract DepositManagerTest is Test, ParseUtils {
    Wallet public wallet;
    Vault public vault;
    TestDepositManager public depositManager;

    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    SimpleERC1155Token[3] ERC1155s;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    address constant ALICE = address(1);
    address constant BOB = address(2);
    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER = vm.addr(SCREENER_PRIVKEY);

    uint256 constant RESERVE_AMOUNT = 50_000_000;
    uint256 constant GAS_COMP_AMOUNT = 10_000_000;

    event DepositInstantiated(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce
    );

    event DepositRetrieved(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce
    );

    event DepositProcessed(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce
    );

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

        depositManager.setScreenerPermission(SCREENER, true);
        wallet.setDepositSourcePermission(address(depositManager), true);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();
        }
    }

    function testInstantiateDepositSuccess() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 25M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT / 2);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT / 2,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            GAS_COMP_AMOUNT // 10M gas comp
        );

        // Deposit hash not yet marked true and ETH balance empty
        bytes32 depositHash = depositManager.hashDepositRequest(deposit);
        assertFalse(depositManager._outstandingDepositHashes(depositHash));
        assertEq(address(depositManager).balance, 0);

        // Set ALICE balance to 10M wei
        vm.deal(ALICE, GAS_COMP_AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit DepositInstantiated(
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.nonce
        );
        vm.prank(ALICE);
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(deposit);

        // Deposit hash marked true
        assertTrue(depositManager._outstandingDepositHashes(depositHash));

        // Token escrowed by manager contract
        assertEq(token.balanceOf(address(depositManager)), deposit.value);

        console.log("Alice remaining eth:", ALICE.balance);
        assertEq(address(depositManager).balance, GAS_COMP_AMOUNT);
    }

    function testInstantiateDepositFailureWrongChainId() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 25M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT / 2);

        DepositRequest memory deposit = DepositRequest({
            chainId: 0x123,
            spender: ALICE,
            encodedAsset: AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(token),
                NocturneUtils.ERC20_ID
            ),
            value: RESERVE_AMOUNT / 2,
            depositAddr: NocturneUtils.defaultStealthAddress(),
            nonce: depositManager._nonces(ALICE),
            gasCompensation: 0 // 0 gas comp
        });

        vm.expectRevert("Wrong chainId");
        depositManager.instantiateDeposit(deposit);
    }

    function testInstantiateDepositFailureWrongSpender() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 25M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT / 2);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT / 2,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            0 // 0 gas price
        );

        vm.prank(BOB); // prank BOB not ALICE
        vm.expectRevert("Only spender can start deposit");
        depositManager.instantiateDeposit(deposit);
    }

    function testInstantiateDepositFailureBadNonce() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT / 2);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT / 2,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE) + 1, // Invalid nonce
            0 // 0 gas price
        );

        // Expect revert
        vm.expectRevert("Invalid nonce");
        vm.prank(ALICE);
        depositManager.instantiateDeposit(deposit);
    }

    function testRetrieveDepositSuccess() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve all 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            GAS_COMP_AMOUNT
        );
        bytes32 depositHash = depositManager.hashDepositRequest(deposit);

        // Call instantiateDeposit
        vm.deal(ALICE, GAS_COMP_AMOUNT);
        vm.prank(ALICE);
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(deposit);

        // Deposit hash marked true
        assertTrue(depositManager._outstandingDepositHashes(depositHash));

        // Token escrowed by manager contract
        assertEq(token.balanceOf(address(depositManager)), deposit.value);

        // Eth received
        assertEq(address(depositManager).balance, GAS_COMP_AMOUNT);
        assertEq(ALICE.balance, 0);

        // Call retrieveDeposit
        vm.expectEmit(true, true, true, true);
        emit DepositRetrieved(
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.nonce
        );
        vm.prank(ALICE);
        depositManager.retrieveDeposit(deposit);

        // Deposit hash marked false again
        assertFalse(depositManager._outstandingDepositHashes(depositHash));

        // Token sent back to user
        assertEq(token.balanceOf(address(depositManager)), 0);
        assertEq(token.balanceOf(address(ALICE)), deposit.value);

        // Eth gas sent back to user
        assertEq(address(depositManager).balance, 0);
        assertEq(ALICE.balance, GAS_COMP_AMOUNT);
    }

    function testRetrieveDepositFailureNotSpender() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve all 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            0
        );

        // Call instantiateDeposit
        vm.prank(ALICE);
        depositManager.instantiateDeposit(deposit);

        // Call retrieveDeposit, but prank as BOB
        vm.expectRevert("Only spender can retrieve deposit");
        vm.prank(BOB);
        depositManager.retrieveDeposit(deposit);
    }

    function testRetrieveDepositFailureNoDeposit() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Create deposit request but never instantiate deposit with it
        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            0
        );

        vm.expectRevert("deposit !exists");
        vm.prank(ALICE);
        depositManager.retrieveDeposit(deposit);
    }

    function testProcessDepositSuccess() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            GAS_COMP_AMOUNT // 10M gas comp
        );

        vm.deal(ALICE, GAS_COMP_AMOUNT);
        vm.prank(ALICE);
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(deposit);

        // Deposit manager has tokens and gas funds
        assertEq(token.balanceOf(address(depositManager)), RESERVE_AMOUNT);
        assertEq(address(depositManager).balance, GAS_COMP_AMOUNT);

        bytes32 digest = depositManager.computeDigest(deposit);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SCREENER_PRIVKEY, digest);
        bytes memory signature = rsvToSignatureBytes(uint256(r), uint256(s), v);

        vm.prank(SCREENER);
        depositManager.processDeposit(deposit, signature);

        assertEq(token.balanceOf(address(vault)), RESERVE_AMOUNT);
        assertEq(token.balanceOf(address(ALICE)), 0);

        // TODO: currently unable to set tx.gasprice in foundry, once added we
        // should check logic for screener compensation. For now we assume all
        // goes back to user.
        assertEq(address(depositManager).balance, 0);
        assertEq(SCREENER.balance, 0);
        assertEq(ALICE.balance, GAS_COMP_AMOUNT);
    }

    function testProcessDepositFailureBadSignature() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            GAS_COMP_AMOUNT // 10M gas comp
        );

        vm.deal(ALICE, GAS_COMP_AMOUNT);
        vm.prank(ALICE);
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(deposit);

        bytes32 digest = depositManager.computeDigest(deposit);
        uint256 randomPrivkey = 123;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(randomPrivkey, digest);
        bytes memory badSignature = rsvToSignatureBytes(
            uint256(r),
            uint256(s),
            v
        );

        vm.expectRevert("request signer !screener");
        vm.prank(SCREENER);
        depositManager.processDeposit(deposit, badSignature);
    }

    function testProcessDepositFailureNonExistentDeposit() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        // Format deposit request but do NOT instantiate deposit
        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            ALICE,
            address(token),
            RESERVE_AMOUNT,
            NocturneUtils.ERC20_ID,
            NocturneUtils.defaultStealthAddress(),
            depositManager._nonces(ALICE),
            GAS_COMP_AMOUNT // 10M gas comp
        );

        bytes32 digest = depositManager.computeDigest(deposit);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SCREENER_PRIVKEY, digest);
        bytes memory badSignature = rsvToSignatureBytes(
            uint256(r),
            uint256(s),
            v
        );

        vm.expectRevert("deposit !exists");
        vm.prank(SCREENER);
        depositManager.processDeposit(deposit, badSignature);
    }
}
