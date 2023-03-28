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
import {Handler} from "../Handler.sol";
import {Wallet} from "../Wallet.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "./tokens/SimpleERC1155Token.sol";

contract DepositManagerTest is Test, ParseUtils {
    Wallet public wallet;
    Handler public handler;
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
        uint256 indexed chainId,
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositRetrieved(
        uint256 indexed chainId,
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositCompleted(
        uint256 indexed chainId,
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    function setUp() public virtual {
        // TODO: extract wallet/handler deployment into NocturneUtils
        wallet = new Wallet();
        handler = new Handler();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        handler.initialize(address(wallet), address(subtreeUpdateVerifier));
        wallet.initialize(address(handler), address(joinSplitVerifier));

        depositManager = new TestDepositManager();
        depositManager.initialize(
            CONTRACT_NAME,
            CONTRACT_VERSION,
            address(wallet)
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

        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            NocturneUtils.ERC20_ID
        );

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
            block.chainid,
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.depositAddr,
            deposit.nonce,
            deposit.gasCompensation
        );
        vm.prank(ALICE);
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(
            encodedToken,
            RESERVE_AMOUNT / 2,
            NocturneUtils.defaultStealthAddress()
        );

        // Deposit hash marked true
        assertTrue(depositManager._outstandingDepositHashes(depositHash));

        // Token escrowed by manager contract
        assertEq(token.balanceOf(address(depositManager)), deposit.value);
        assertEq(address(depositManager).balance, GAS_COMP_AMOUNT);
    }

    function testRetrieveDepositSuccess() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve all 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            NocturneUtils.ERC20_ID
        );

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
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(
            encodedToken,
            RESERVE_AMOUNT,
            NocturneUtils.defaultStealthAddress()
        );

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
            block.chainid,
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.depositAddr,
            deposit.nonce,
            deposit.gasCompensation
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

        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            NocturneUtils.ERC20_ID
        );

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
        depositManager.instantiateDeposit(
            encodedToken,
            RESERVE_AMOUNT,
            NocturneUtils.defaultStealthAddress()
        );

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

    function testCompleteDepositSuccess() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            NocturneUtils.ERC20_ID
        );

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
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(
            encodedToken,
            RESERVE_AMOUNT,
            NocturneUtils.defaultStealthAddress()
        );

        // Deposit manager has tokens and gas funds
        assertEq(token.balanceOf(address(depositManager)), RESERVE_AMOUNT);
        assertEq(address(depositManager).balance, GAS_COMP_AMOUNT);

        bytes32 digest = depositManager.computeDigest(deposit);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SCREENER_PRIVKEY, digest);
        bytes memory signature = rsvToSignatureBytes(uint256(r), uint256(s), v);

        vm.expectEmit(true, true, true, true);
        emit DepositCompleted(
            block.chainid,
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.depositAddr,
            deposit.nonce,
            deposit.gasCompensation
        );

        vm.prank(SCREENER);
        depositManager.completeDeposit(deposit, signature);

        // Ensure wallet now has ALICE's tokens
        assertEq(token.balanceOf(address(wallet)), RESERVE_AMOUNT);
        assertEq(token.balanceOf(address(ALICE)), 0);

        // TODO: We want to check that some gas went to screener and rest went
        // back to ALICE. Currently unable to because we can't set tx.gasprice
        // in foundry. once added we should check logic for screener
        // compensation. For now we assume all goes back to user.
        assertEq(address(depositManager).balance, 0);
        assertEq(SCREENER.balance, 0);
        assertEq(ALICE.balance, GAS_COMP_AMOUNT);
    }

    function testCompleteDepositFailureBadSignature() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, RESERVE_AMOUNT);

        // Approve 50M tokens for deposit
        vm.prank(ALICE);
        token.approve(address(depositManager), RESERVE_AMOUNT);

        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(token),
            NocturneUtils.ERC20_ID
        );

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
        depositManager.instantiateDeposit{value: GAS_COMP_AMOUNT}(
            encodedToken,
            RESERVE_AMOUNT,
            NocturneUtils.defaultStealthAddress()
        );

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
        depositManager.completeDeposit(deposit, badSignature);
    }

    function testCompleteDepositFailureNonExistentDeposit() public {
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
        bytes memory signature = rsvToSignatureBytes(uint256(r), uint256(s), v);

        vm.expectRevert("deposit !exists");
        vm.prank(SCREENER);
        depositManager.completeDeposit(deposit, signature);
    }
}
