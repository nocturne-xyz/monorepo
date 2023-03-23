// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IJoinSplitVerifier} from "../interfaces/IJoinSplitVerifier.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {WalletUtils} from "../libs/WalletUtils.sol";
import {Wallet} from "../Wallet.sol";
import {TestBalanceManager} from "./harnesses/TestBalanceManager.sol";
import {TestVault} from "./harnesses/TestVault.sol";
import "./utils/NocturneUtils.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "./tokens/SimpleERC1155Token.sol";
import {Utils} from "../libs/Utils.sol";
import {AssetUtils} from "../libs/AssetUtils.sol";
import "../libs/Types.sol";

contract BalanceManagerTest is Test {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    using stdJson for string;
    using OperationLib for Operation;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 0;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant BUNDLER = address(3);
    uint256 constant PER_NOTE_AMOUNT = uint256(50_000_000);

    uint256 constant DEFAULT_PER_JOINSPLIT_VERIFY_GAS = 170_000;

    // Check storage layout file
    uint256 constant OPERATION_STAGE_STORAGE_SLOT = 74;
    uint256 constant ENTERED_EXECUTE_ACTIONS = 3;

    TestBalanceManager balanceManager;
    Wallet wallet;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    SimpleERC1155Token[3] ERC1155s;

    function setUp() public virtual {
        // Instantiate wallet, joinSplitVerifier, tree, and balanceManager
        wallet = new Wallet();
        joinSplitVerifier = new TestJoinSplitVerifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager = new TestBalanceManager();
        balanceManager.initialize(
            address(wallet),
            address(subtreeUpdateVerifier)
        );

        wallet.initialize(address(balanceManager), address(joinSplitVerifier));
        wallet.setDepositSourcePermission(ALICE, true);

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
            ERC1155s[i] = new SimpleERC1155Token();
        }
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        StealthAddress memory addr = NocturneUtils.defaultStealthAddress();
        DepositRequest memory deposit = NocturneUtils.formatDepositRequest(
            recipient,
            address(token),
            amount,
            ERC20_ID,
            addr,
            0, // nonce and gasPrice irrelevant
            0
        );

        vm.prank(recipient);
        token.approve(address(wallet), amount);

        vm.prank(ALICE);
        wallet.depositFunds(deposit);
    }

    function testOnErc721ReceivedEnteredExecute() public {
        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Token balance manager will receive
        SimpleERC721Token erc721 = ERC721s[0];
        uint256 tokenId = 1;
        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC721,
            address(erc721),
            tokenId
        );

        // Mint and send token to balance manager
        assertEq(balanceManager.receivedAssetsLength(), 0);
        erc721.reserveToken(ALICE, tokenId);
        vm.prank(ALICE);
        erc721.safeTransferFrom(ALICE, address(balanceManager), tokenId);

        // Ensure token was received
        assertEq(balanceManager.receivedAssetsLength(), 1);
        EncodedAsset memory received = balanceManager.getReceivedAssetsByIndex(
            0
        );
        assertEq(received.encodedAssetAddr, encodedToken.encodedAssetAddr);
        assertEq(received.encodedAssetId, encodedToken.encodedAssetId);
    }

    function testOnErc721ReceivedFailureNotEntered() public {
        // NOTE: we never override the reentrancy guard, thus stage = NOT_ENTERED

        // Token balance manager will receive
        SimpleERC721Token erc721 = ERC721s[0];
        uint256 tokenId = 1;

        // Expect safeTransferFrom to fail because balance stage = NOT_ENTERED
        assertEq(balanceManager.receivedAssetsLength(), 0);
        erc721.reserveToken(ALICE, tokenId);
        vm.prank(ALICE);
        vm.expectRevert("ERC721: transfer to non ERC721Receiver implementer");
        erc721.safeTransferFrom(ALICE, address(balanceManager), tokenId);
        assertEq(balanceManager.receivedAssetsLength(), 0);
    }

    function testOnErc1155ReceivedEnteredExecute() public {
        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Token balance manager will receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId = 1;
        EncodedAsset memory encodedToken = AssetUtils.encodeAsset(
            AssetType.ERC1155,
            address(erc1155),
            tokenId
        );

        // Mint and send token to balance manager
        uint256 tokenAmount = 100;
        assertEq(erc1155.balanceOf(address(balanceManager), tokenId), 0);
        assertEq(balanceManager.receivedAssetsLength(), 0);
        erc1155.reserveTokens(ALICE, tokenId, tokenAmount);
        vm.prank(ALICE);
        erc1155.safeTransferFrom(
            ALICE,
            address(balanceManager),
            tokenId,
            tokenAmount,
            bytes("")
        );

        // Ensure tokens were received
        assertEq(
            erc1155.balanceOf(address(balanceManager), tokenId),
            tokenAmount
        );
        assertEq(balanceManager.receivedAssetsLength(), 1);
        EncodedAsset memory received = balanceManager.getReceivedAssetsByIndex(
            0
        );
        assertEq(received.encodedAssetAddr, encodedToken.encodedAssetAddr);
        assertEq(received.encodedAssetId, encodedToken.encodedAssetId);
    }

    function testOnErc1155FailureReceivedNotEntered() public {
        // NOTE: we never override the reentrancy guard, thus stage = NOT_ENTERED

        // Token balance manager will attempt to receive
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 tokenId = 1;

        uint256 tokenAmount = 100;

        // Mint but transfer attempt will revert
        assertEq(balanceManager.receivedAssetsLength(), 0);
        erc1155.reserveTokens(ALICE, tokenId, tokenAmount);
        vm.prank(ALICE);
        vm.expectRevert("ERC1155: ERC1155Receiver rejected tokens");
        erc1155.safeTransferFrom(
            ALICE,
            address(balanceManager),
            tokenId,
            tokenAmount,
            bytes("")
        );
        assertEq(balanceManager.receivedAssetsLength(), 0);
    }

    function testMakeDeposit() public {
        SimpleERC20Token token = ERC20s[0];
        uint256 depositAmount = 10;

        // Pre-deposit state
        assertEq(balanceManager.totalCount(), 0);
        assertEq(token.balanceOf(address(wallet)), 0);

        reserveAndDepositFunds(ALICE, token, depositAmount);

        // Post-deposit state
        assertEq(balanceManager.totalCount(), 1);
        assertEq(token.balanceOf(address(wallet)), depositAmount);
    }

    function testProcessJoinSplitsGasPriceZero() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Balance manager took up 100M of token
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(token.balanceOf(address(balanceManager)), 100_000_000);
    }

    function testProcessJoinSplitsReservingFeeSingleFeeNote() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token with gas price of 50 (see total
        // fee below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // gasPrice * (providedExecutionGas + gasPerJoinSplit + gasPerRefund)
        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 totalFeeReserved = balanceManager.calculateOpGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Balance manager took up 50M, left 50M for bundler
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved
        );
        assertEq(token.balanceOf(address(wallet)), totalFeeReserved);
    }

    function testProcessJoinSplitsReservingFeeTwoFeeNotes() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 150M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 3);

        // Unwrap 150M and setting gas price to 50. 2 joinsplits needed for
        // calculated fee (see below)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // gasPrice * (executionGas + joinSplitGas + refundGas)
        // 50 * (500k + (3 * 170k) + (3 * 80k)) = 62.5M
        uint256 totalFeeReserved = balanceManager.calculateOpGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Balance manager took up 150M - 62.5M
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (3 * PER_NOTE_AMOUNT) - totalFeeReserved
        );
        assertEq(token.balanceOf(address(wallet)), totalFeeReserved);
    }

    function testProcessJoinSplitsReservingFeeAndPayBundler() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M and set gas price to 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // 50 * (executionGas + (2 * joinSplitGas) + (2 * refundGas))
        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 totalFeeReserved = balanceManager.calculateOpGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );

        // Take up 100M tokens
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - totalFeeReserved
        );

        // Only bundler fee: 50 * (executionGas + verificationGas + handleJoinSplitGas + handleRefundGas)
        // 50 * (500k + (2 * 170k) + (2 * 50k)) = 47M
        // NOTE: verification gas defaults to numJoinSplits * GAS_PER_JOINSPLIT_VERIFY formatDummyOperationResult defaults to this
        OperationResult memory opResult = NocturneUtils
            .formatDummyOperationResult(op);
        uint256 onlyBundlerFee = balanceManager.calculateBundlerGasAssetPayout(
            op,
            opResult
        );

        balanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS,
            BUNDLER
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT) - onlyBundlerFee
        );
        assertEq(token.balanceOf(BUNDLER), onlyBundlerFee);

        // TODO: pay out subtree updater
    }

    function testProcessJoinSplitsFailureNotEnoughForFee() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposit only 50M tokens (we will see gas comp is 62.5M)
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT);

        // Unwrap 50M, not enough for bundler comp with 3 joinsplits and gas
        // price of 50
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT / 3,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                maxNumRefunds: 1,
                gasPrice: 50,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // gasPrice * (executionGas + joinSplitGas + refundGas)
        // 50 * (500k + (3 * 170k) + (3 * 80k)) = 62.5M
        // NOTE: we only deposited 50M
        uint256 totalFeeReserved = balanceManager.calculateOpGasAssetCost(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertGt(totalFeeReserved, PER_NOTE_AMOUNT);

        // Expect revert due to not having enough to pay fee
        vm.expectRevert("Too few gas tokens");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureNotEnoughFundsForUnwrap() public {
        SimpleERC20Token token = ERC20s[0];

        // Only reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Attempts to unwrap 100M of token (we only deposited 50M)
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureBadRoot() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Operation with bad merkle root fails joinsplit processing
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.BAD_ROOT
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("Tree root not past root");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureAlreadyUsedNullifier() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Create operation with two joinsplits where 1st uses NF included in
        // 2nd joinsplit
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NF_ALREADY_IN_SET
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("Nullifier B already used");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testProcessJoinSplitsFailureMatchingNullifiers() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 1);

        // Create operation with one of the joinsplits has matching NFs A and B
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.JOINSPLIT_NFS_SAME
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("2 nfs should !equal");
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
    }

    function testHandleRefundsJoinSplitsSingleAsset() public {
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, PER_NOTE_AMOUNT * 2);

        // Unwrap 100M of token
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: token,
                gasToken: token,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0, // don't reserve any gas, wallet takes up all
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Take up 100M tokens
        balanceManager.processJoinSplitsReservingFee(
            op,
            DEFAULT_PER_JOINSPLIT_VERIFY_GAS
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * PER_NOTE_AMOUNT)
        );
        assertEq(token.balanceOf(address(wallet)), 0);

        // Expect all 100M to be refunded to wallet
        balanceManager.handleAllRefunds(op);
        assertEq(token.balanceOf(address(balanceManager)), 0);
        assertEq(token.balanceOf(address(wallet)), (2 * PER_NOTE_AMOUNT));
    }

    function testHandleRefundsRefundAssetsSingleAsset() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];
        SimpleERC20Token refundToken = ERC20s[1];

        // Refund asset
        EncodedAsset[] memory refundAssets = new EncodedAsset[](1);
        refundAssets[0] = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(refundToken),
            ERC20_ID
        );

        // Dummy operation, we're only interested in refundAssets
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: joinSplitToken,
                gasToken: joinSplitToken,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: refundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Send refund tokens to balance manager
        uint256 refundAmount = 10_000_000;
        refundToken.reserveTokens(ALICE, refundAmount);
        vm.prank(ALICE);
        refundToken.transfer(address(balanceManager), refundAmount);

        // Expect all refund tokens to be refunded to wallet
        balanceManager.handleAllRefunds(op);
        assertEq(refundToken.balanceOf(address(balanceManager)), 0);
        assertEq(refundToken.balanceOf(address(wallet)), refundAmount);
    }

    function testHandleRefundsReceivedAssets() public {
        SimpleERC20Token joinSplitToken = ERC20s[0];

        // Dummy operation, we only care about the received assets which we setup
        // manually
        Operation memory op = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: joinSplitToken,
                gasToken: joinSplitToken,
                root: balanceManager.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                maxNumRefunds: 1,
                gasPrice: 0,
                actions: new Action[](0),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        // Token balance manager will receive erc721 + erc1155
        SimpleERC721Token erc721 = ERC721s[0];
        SimpleERC1155Token erc1155 = ERC1155s[0];
        uint256 erc721Id = 1;
        uint256 erc1155Id = 2;
        uint256 erc1155Amount = 100;

        // Override reentrancy guard so balance manager can receive token
        vm.store(
            address(balanceManager),
            bytes32(OPERATION_STAGE_STORAGE_SLOT),
            bytes32(ENTERED_EXECUTE_ACTIONS)
        );

        // Mint and send token to balance manager
        assertEq(balanceManager.receivedAssetsLength(), 0);
        erc721.reserveToken(ALICE, erc721Id);
        erc1155.reserveTokens(ALICE, erc1155Id, erc1155Amount);
        vm.prank(ALICE);
        erc721.safeTransferFrom(ALICE, address(balanceManager), erc721Id);
        vm.prank(ALICE);
        erc1155.safeTransferFrom(
            ALICE,
            address(balanceManager),
            erc1155Id,
            erc1155Amount,
            bytes("")
        );
        assertEq(balanceManager.receivedAssetsLength(), 2);

        // Pre-refund balances
        assertEq(erc721.balanceOf(address(balanceManager)), 1);
        assertEq(erc721.balanceOf(address(wallet)), 0);
        assertEq(erc721.ownerOf(erc721Id), address(balanceManager));

        assertEq(
            erc1155.balanceOf(address(balanceManager), erc1155Id),
            erc1155Amount
        );
        assertEq(erc1155.balanceOf(address(wallet), erc1155Id), 0);

        balanceManager.handleAllRefunds(op);

        // Post-refund balances (wallet owns what balance manager had)
        assertEq(erc721.balanceOf(address(balanceManager)), 0);
        assertEq(erc721.balanceOf(address(wallet)), 1);
        assertEq(erc721.ownerOf(erc721Id), address(wallet));

        assertEq(erc1155.balanceOf(address(balanceManager), erc1155Id), 0);
        assertEq(erc1155.balanceOf(address(wallet), erc1155Id), erc1155Amount);
    }
}
