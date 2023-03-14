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

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();
        }
    }

    function testInstantiateDepositSuccessNoGasPayment() public {
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

        // Deposit hash not yet marked true
        bytes32 depositHash = depositManager.hashDepositRequest(deposit);
        assertFalse(depositManager._outstandingDepositHashes(depositHash));

        vm.expectEmit(true, true, true, true);
        emit DepositInstantiated(
            deposit.spender,
            deposit.encodedAsset,
            deposit.value,
            deposit.nonce
        );
        vm.prank(ALICE);
        depositManager.instantiateDeposit(deposit);

        // Deposit hash marked true
        assertTrue(depositManager._outstandingDepositHashes(depositHash));
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
            gasPrice: 0 // 0 gas price
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

    // TODO: test deposit successfully goes through with wallet contract
}
