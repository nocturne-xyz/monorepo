// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {ISpend2Verifier} from "../interfaces/ISpend2Verifier.sol";
import {IOffchainMerkleTree} from "../interfaces/IOffchainMerkleTree.sol";
import {ISubtreeUpdateVerifier} from "../interfaces/ISubtreeUpdateVerifier.sol";
import {OffchainMerkleTree} from "../OffchainMerkleTree.sol";
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestSpend2Verifier} from "./utils/TestSpend2Verifier.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";

contract DummyWalletTest is Test, TestUtils, PoseidonDeployer {
    using stdJson for string;
    using TreeTestLib for TreeTest;

    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant ALICE = address(1);
    address constant BOB = address(2);

    Wallet wallet;
    Vault vault;
    TreeTest treeTest;
    IOffchainMerkleTree merkle;
    ISpend2Verifier spend2Verifier;
    ISubtreeUpdateVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

    event Refund(
        IWallet.FLAXAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint128 merkleIndex
    );

    event Spend(
        uint256 indexed oldNoteNullifier,
        uint256 indexed valueSpent,
        uint128 indexed merkleIndex
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        // Instantiate vault, spend2Verifier, tree, and wallet
        vault = new Vault();
        spend2Verifier = new TestSpend2Verifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();
        merkle = new OffchainMerkleTree(address(subtreeUpdateVerifier));

        wallet = new Wallet(
            address(vault),
            address(spend2Verifier),
            address(merkle)
        );

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonT3));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonT6));

        treeTest.initialize(hasherT3, hasherT6);

        vault.initialize(address(wallet));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
        }
    }

    function defaultFlaxAddress()
        internal
        pure
        returns (IWallet.FLAXAddress memory)
    {
        return
            IWallet.FLAXAddress({
                h1X: 1938477,
                h1Y: 9104058,
                h2X: 1032988,
                h2Y: 1032988
            });
    }

    function dummyProof()
        internal
        pure
        returns (uint256[8] memory _values)
    {
        for (uint256 i = 0; i < 8; i++) {
            _values[i] = uint256(4757829);
        }
    }

    function depositFunds(
        Wallet _wallet,
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        IWallet.FLAXAddress memory _depositAddr
    ) public {
        wallet.depositFunds(
            IWallet.Deposit({
                spender: _spender,
                asset: _asset,
                value: _value,
                id: _id,
                depositAddr: _depositAddr
            })
        );
    }

    function aliceDepositFunds(SimpleERC20Token token) public {
        token.reserveTokens(ALICE, 1000);

        vm.prank(ALICE);
        token.approve(address(vault), 800);

        uint256[] memory batch = new uint256[](16);

        // Deposit funds to vault
        for (uint256 i = 0; i < 8; i++) {
            vm.expectEmit(true, true, true, true);
            IWallet.FLAXAddress memory addr = defaultFlaxAddress();
            emit Refund(
                addr,
                i,
                address(token),
                ERC20_ID,
                100,
                uint128(i)
            );

            vm.prank(ALICE);
            depositFunds(
                wallet,
                ALICE,
                address(token),
                100,
                ERC20_ID,
                addr
            );

            IWallet.Note memory note = IWallet.Note(addr.h1X, addr.h2X, i, uint256(uint160(address(token))), ERC20_ID, 100);
            uint256 noteCommitment = treeTest.computeNoteCommitment(note);

            batch[i] = noteCommitment;
        }

        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 root = path[path.length - 1];

        // insert 8 empty leaves into tree
        uint256[] memory ncs = new uint256[](8);
        merkle.insertNoteCommitments(ncs);

        wallet.applySubtreeUpdate(
            root,
            dummyProof()
        );
    }

    function testPoseidon() public {
        console.log(
            new PoseidonHasherT3(poseidonT3).hash([uint256(0), uint256(1)])
        );
        console.log(
            new PoseidonHasherT4(poseidonT4).hash(
                [uint256(0), uint256(1), uint256(2)]
            )
        );
        console.log(
            new PoseidonHasherT5(poseidonT5).hash(
                [uint256(0), uint256(1), uint256(2), uint256(3)]
            )
        );
        console.log(
            new PoseidonHasherT6(poseidonT6).hash(
                [uint256(0), uint256(1), uint256(2), uint256(3), uint256(4)]
            )
        );
    }

    function testDummyTransferNoRefund() public {
        SimpleERC20Token token = ERC20s[0];
        aliceDepositFunds(token);

        // Create transaction to withdraw 100 token from vault and transfer
        // 50 to bob
        bytes memory encodedFunction = abi.encodeWithSelector(
            token.transfer.selector,
            BOB,
            50
        );
        IWallet.Action memory transferAction = IWallet.Action({
            contractAddress: address(token),
            encodedFunction: encodedFunction
        });

        uint256 root = merkle.root();
        IWallet.SpendTransaction memory spendTx = IWallet.SpendTransaction({
            commitmentTreeRoot: root,
            nullifier: uint256(182),
            newNoteCommitment: uint256(1038),
            proof: dummyProof(),
            valueToSpend: uint256(50),
            asset: address(token),
            id: ERC20_ID
        });

        address[] memory spendTokens = new address[](1);
        spendTokens[0] = address(token);
        address[] memory refundTokens = new address[](1);
        refundTokens[0] = address(token);
        IWallet.Tokens memory tokens = IWallet.Tokens({
            spendTokens: spendTokens,
            refundTokens: refundTokens
        });

        IWallet.SpendTransaction[]
            memory spendTxs = new IWallet.SpendTransaction[](1);
        spendTxs[0] = spendTx;
        IWallet.Action[] memory actions = new IWallet.Action[](1);
        actions[0] = transferAction;
        IWallet.Operation memory op = IWallet.Operation({
            spendTxs: spendTxs,
            refundAddr: defaultFlaxAddress(),
            tokens: tokens,
            actions: actions,
            gasLimit: DEFAULT_GAS_LIMIT
        });

        IWallet.Operation[] memory ops = new IWallet.Operation[](1);
        ops[0] = op;
        IWallet.Bundle memory bundle = IWallet.Bundle({operations: ops});

        // Ensure 50 tokens have changed hands
        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(800));
        assertEq(token.balanceOf(address(ALICE)), uint256(200));
        assertEq(token.balanceOf(address(BOB)), uint256(0));

        vm.expectEmit(false, true, true, true);
        emit Spend(0, 50, uint128(16)); // only checking value and merkleIndex are valid

        wallet.processBundle(bundle);

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(750));
        assertEq(token.balanceOf(address(ALICE)), uint256(200));
        assertEq(token.balanceOf(address(BOB)), uint256(50));
    }
}
