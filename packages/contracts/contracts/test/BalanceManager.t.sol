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
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "./harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./harnesses/TestSubtreeUpdateVerifier.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {WalletUtils} from "../libs/WalletUtils.sol";
import {Vault} from "../Vault.sol";
import {TestBalanceManager} from "./harnesses/TestBalanceManager.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {Utils} from "../libs/Utils.sol";
import {AssetUtils} from "../libs/AssetUtils.sol";
import "../libs/Types.sol";

contract BalanceManagerTest is Test, TestUtils, PoseidonDeployer {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;
    using OperationLib for Operation;

    uint256 constant DEFAULT_GAS_LIMIT = 500_000;
    uint256 constant ERC20_ID = 1;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant BUNDLER = address(3);
    uint256 constant PER_DEPOSIT_AMOUNT = uint256(1 gwei);

    TestBalanceManager balanceManager;
    Vault vault;
    TreeTest treeTest;
    IJoinSplitVerifier joinSplitVerifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

    struct TransferOperationArgs {
        SimpleERC20Token token;
        address recipient;
        uint256 amount;
        uint256 publicSpendPerJoinSplit;
        uint256 numJoinSplits;
        EncodedAsset[] encodedRefundAssets;
        uint256 verificationGasLimit;
        uint256 executionGasLimit;
        uint256 gasPrice;
    }

    event RefundProcessed(
        StealthAddress refundAddr,
        uint256 nonce,
        uint256 encodedAssetAddr,
        uint256 encodedAssetId,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplitProcessed(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        JoinSplit joinSplit
    );

    event OperationProcessed(
        uint256 indexed operationDigest,
        bool indexed opProcessed,
        string failureReason,
        bool[] callSuccesses,
        bytes[] callResults
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        // Instantiate vault, joinSplitVerifier, tree, and balanceManager
        vault = new Vault();
        joinSplitVerifier = new TestJoinSplitVerifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        balanceManager = new TestBalanceManager();
        balanceManager.initialize(
            address(vault),
            address(joinSplitVerifier),
            address(subtreeUpdateVerifier)
        );

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT3, hasherT6);

        vault.initialize(address(balanceManager));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
        }
    }

    function defaultStealthAddress()
        internal
        pure
        returns (StealthAddress memory)
    {
        return
            StealthAddress({
                h1X: 1938477,
                h1Y: 9104058,
                h2X: 1032988,
                h2Y: 1032988
            });
    }

    function dummyProof() internal pure returns (uint256[8] memory _values) {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function formatDeposit(
        address spender,
        address asset,
        uint256 value,
        uint256 id,
        StealthAddress memory depositAddr
    ) public pure returns (Deposit memory) {
        return
            Deposit({
                spender: spender,
                encodedAssetAddr: uint256(uint160(asset)),
                encodedAssetId: id,
                value: value,
                depositAddr: depositAddr
            });
    }

    function reserveAndDepositFunds(
        address recipient,
        SimpleERC20Token token,
        uint256 amount
    ) internal {
        token.reserveTokens(recipient, amount);

        StealthAddress memory addr = defaultStealthAddress();
        Deposit memory deposit = formatDeposit(
            recipient,
            address(token),
            amount,
            ERC20_ID,
            addr
        );

        vm.prank(recipient);
        token.approve(address(vault), amount);

        vm.prank(recipient);
        balanceManager.makeDeposit(deposit);
    }

    function formatTransferOperation(
        TransferOperationArgs memory args
    ) internal view returns (Operation memory) {
        Action memory transferAction = Action({
            contractAddress: address(args.token),
            encodedFunction: abi.encodeWithSelector(
                args.token.transfer.selector,
                args.recipient,
                args.amount
            )
        });

        uint256 root = balanceManager.root();
        EncryptedNote memory newNoteAEncrypted = EncryptedNote({
            owner: StealthAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });
        EncryptedNote memory newNoteBEncrypted = EncryptedNote({
            owner: StealthAddress({
                h1X: uint256(123),
                h1Y: uint256(123),
                h2X: uint256(123),
                h2Y: uint256(123)
            }),
            encappedKey: uint256(111),
            encryptedNonce: uint256(111),
            encryptedValue: uint256(111)
        });

        EncodedAsset memory encodedAsset = EncodedAsset({
            encodedAssetAddr: uint256(uint160(address(args.token))),
            encodedAssetId: uint256(0)
        });

        JoinSplit[] memory joinSplits = new JoinSplit[](args.numJoinSplits);
        for (uint256 i = 0; i < args.numJoinSplits; i++) {
            joinSplits[i] = JoinSplit({
                commitmentTreeRoot: root,
                nullifierA: uint256(2 * i),
                nullifierB: uint256(2 * i + 1),
                newNoteACommitment: uint256(i),
                newNoteAEncrypted: newNoteAEncrypted,
                newNoteBCommitment: uint256(i),
                newNoteBEncrypted: newNoteBEncrypted,
                proof: dummyProof(),
                encodedAsset: encodedAsset,
                publicSpend: args.publicSpendPerJoinSplit
            });
        }

        Action[] memory actions = new Action[](1);
        actions[0] = transferAction;
        Operation memory op = Operation({
            joinSplits: joinSplits,
            refundAddr: defaultStealthAddress(),
            encodedRefundAssets: args.encodedRefundAssets,
            actions: actions,
            verificationGasLimit: args.verificationGasLimit,
            executionGasLimit: args.executionGasLimit,
            gasPrice: args.gasPrice,
            maxNumRefunds: joinSplits.length + args.encodedRefundAssets.length
        });

        return op;
    }

    function formatOperationResult(
        Operation memory op
    ) public pure returns (OperationResult memory result) {
        return
            OperationResult({
                opProcessed: true,
                failureReason: "",
                callSuccesses: new bool[](0),
                callResults: new bytes[](0),
                executionGas: op.executionGasLimit,
                verificationGas: op.verificationGasLimit,
                numRefunds: op.joinSplits.length + op.encodedRefundAssets.length
            });
    }

    function testMakeDeposit() public {
        SimpleERC20Token token = ERC20s[0];
        uint256 depositAmount = 10;

        // Pre-deposit state
        assertEq(balanceManager.totalCount(), 0);
        assertEq(token.balanceOf(address(vault)), 0);

        reserveAndDepositFunds(ALICE, token, depositAmount);

        // Post-deposit state
        assertEq(balanceManager.totalCount(), 1);
        assertEq(token.balanceOf(address(vault)), depositAmount);
    }

    function testProcessJoinSplitsNotEnoughFundsOwned() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Only reserves + deposits 50M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 1);

        // Attempts to unwrap 100M of token (exceeds owned)
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: perNoteAmount,
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 0
            })
        );

        // Expect revert for processing joinsplits
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        balanceManager.processJoinSplitsReservingFee(op);
    }

    function testProcessJoinSplitsGasPriceZero() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 2);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: perNoteAmount,
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 0
            })
        );

        // Balance manager took up 100M of token
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(op);
        assertEq(token.balanceOf(address(balanceManager)), 100_000_000);
    }

    function testProcessJoinSplitsReservingFeeSingleFeeNote() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 2);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: perNoteAmount, // only transfer 50M, other 50M for fee
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 50
            })
        );

        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 feeReserved = balanceManager.calculateOpGasAssetCost(op);

        // Balance manager took up 50M, left 50M for bundler
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(op);
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * perNoteAmount) - feeReserved
        );
        assertEq(token.balanceOf(address(vault)), feeReserved);
    }

    function testProcessJoinSplitsReservingFeeTwoFeeNotes() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 150M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 3);

        // Unwrap 150M of token (alice has sufficient balance)
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: perNoteAmount,
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 3,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT, // 500k
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 3,
                gasPrice: 50
            })
        );

        // 50 * (500k + (3 * 170k) + (3 * 80k)) = 62.5M
        uint256 feeReserved = balanceManager.calculateOpGasAssetCost(op);

        // Balance manager took up 150M - 62.5M
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(op);
        assertEq(
            token.balanceOf(address(balanceManager)),
            (3 * perNoteAmount) - feeReserved
        );
        assertEq(token.balanceOf(address(vault)), feeReserved);
    }

    function testProcessJoinSplitsReservingFeeAndPayBundler() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 2);

        // Unwrap 100M of token (alice has sufficient balance)
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: perNoteAmount, // only transfer 50M, other 50M for fee
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 50
            })
        );

        // 50 * (500k + (2 * 170k) + (2 * 80k)) = 50M
        uint256 feeReserved = balanceManager.calculateOpGasAssetCost(op);

        // Take up 100M tokens
        assertEq(token.balanceOf(address(balanceManager)), 0);
        balanceManager.processJoinSplitsReservingFee(op);
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * perNoteAmount) - feeReserved
        );

        // Bundler payout ends up 40M of the 50M reserved (other 10M for updater)
        OperationResult memory opResult = formatOperationResult(op);
        uint256 onlyBundlerFee = balanceManager.calculateBundlerGasAssetPayout(
            op,
            opResult
        );

        balanceManager.gatherReservedGasAssetAndPayBundler(
            op,
            opResult,
            BUNDLER
        );
        assertEq(
            token.balanceOf(address(balanceManager)),
            (2 * perNoteAmount) - onlyBundlerFee
        );
        assertEq(token.balanceOf(BUNDLER), onlyBundlerFee);

        // TODO: pay out subtree updater
    }

    function testHandleRefundsJoinSplitsSingleAsset() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token token = ERC20s[0];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, token, perNoteAmount * 2);

        // Unwrap 100M of token
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: token,
                recipient: BOB,
                amount: 0, // not transferring anything, want to refund all
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 0 // not paying bundler anything, refund all
            })
        );

        // Take up 100M tokens
        balanceManager.processJoinSplitsReservingFee(op);
        assertEq(token.balanceOf(address(balanceManager)), (2 * perNoteAmount));
        assertEq(token.balanceOf(address(vault)), 0);

        balanceManager.handleAllRefunds(op);
        assertEq(token.balanceOf(address(balanceManager)), 0);
        assertEq(token.balanceOf(address(vault)), (2 * perNoteAmount));
    }

    function testHandleRefundsRefundAssetsSingleAsset() public {
        uint256 perNoteAmount = 50_000_000;
        SimpleERC20Token joinSplitToken = ERC20s[0];
        SimpleERC20Token refundToken = ERC20s[1];

        // Reserves + deposits 100M of token
        reserveAndDepositFunds(ALICE, joinSplitToken, perNoteAmount * 2);

        // Refund asset
        EncodedAsset[] memory refundAssets = new EncodedAsset[](1);
        refundAssets[0] = EncodedAsset({
            encodedAssetAddr: uint256(uint160(address(refundToken))),
            encodedAssetId: uint256(0)
        });

        console.log("Refund asset", address(refundToken));

        // Dummy operation, we're only interested in refundAssets
        Operation memory op = formatTransferOperation(
            TransferOperationArgs({
                token: joinSplitToken,
                recipient: BOB,
                amount: 0,
                publicSpendPerJoinSplit: perNoteAmount,
                numJoinSplits: 2,
                encodedRefundAssets: refundAssets,
                executionGasLimit: DEFAULT_GAS_LIMIT,
                verificationGasLimit: GAS_PER_JOINSPLIT_VERIFY * 2,
                gasPrice: 0
            })
        );

        // Send refund tokens to balance manager
        uint256 refundAmount = 10_000_000;
        refundToken.reserveTokens(ALICE, refundAmount);
        vm.prank(ALICE);
        refundToken.transfer(address(balanceManager), refundAmount);

        balanceManager.handleAllRefunds(op);
        assertEq(refundToken.balanceOf(address(balanceManager)), 0);
        assertEq(refundToken.balanceOf(address(vault)), refundAmount);
    }

    // // Refund joinsplit
    // Refund refund asset

    // Override __BalanceManager_init to mock operation stage
    // Refund received assets (erc721/1155)
}
