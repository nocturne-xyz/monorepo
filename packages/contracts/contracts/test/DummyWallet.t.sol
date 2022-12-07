// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../libs/OffchainMerkleTree.sol";
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {PoseidonDeployer} from "./utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "./utils/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "./utils/TestSubtreeUpdateVerifier.sol";
import {TreeTest, TreeTestLib} from "./utils/TreeTest.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {CommitmentTreeManager} from "../CommitmentTreeManager.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {SimpleERC20Token} from "../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../tokens/SimpleERC721Token.sol";
import {Utils} from "../libs/Utils.sol";

contract DummyWalletTest is Test, TestUtils, PoseidonDeployer {
    using OffchainMerkleTree for OffchainMerkleTreeData;
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    using stdJson for string;
    using TreeTestLib for TreeTest;

    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant ALICE = address(1);
    address constant BOB = address(2);

    Wallet wallet;
    Vault vault;
    TreeTest treeTest;
    IVerifier joinSplitVerifier;
    IVerifier subtreeUpdateVerifier;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;
    IHasherT3 hasherT3;
    IHasherT6 hasherT6;

    event Refund(
        IWallet.NocturneAddress refundAddr,
        uint256 indexed nonce,
        address indexed asset,
        uint256 indexed id,
        uint256 value,
        uint128 merkleIndex
    );

    event JoinSplit(
        uint256 indexed oldNoteANullifier,
        uint256 indexed oldNoteBNullifier,
        uint128 newNoteAIndex,
        uint128 newNoteBIndex,
        IWallet.JoinSplitTransaction joinSplitTx
    );

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        deployPoseidon3Through6();

        // Instantiate vault, joinSplitVerifier, tree, and wallet
        vault = new Vault();
        joinSplitVerifier = new TestJoinSplitVerifier();

        subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        wallet = new Wallet(
            address(vault),
            address(joinSplitVerifier),
            address(subtreeUpdateVerifier)
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

    function defaultNocturneAddress()
        internal
        pure
        returns (IWallet.NocturneAddress memory)
    {
        return
            IWallet.NocturneAddress({
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

    function depositFunds(
        Wallet _wallet,
        address _spender,
        address _asset,
        uint256 _value,
        uint256 _id,
        IWallet.NocturneAddress memory _depositAddr
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
            IWallet.NocturneAddress memory addr = defaultNocturneAddress();
            emit Refund(addr, i, address(token), ERC20_ID, 100, uint128(i));

            vm.prank(ALICE);
            depositFunds(wallet, ALICE, address(token), 100, ERC20_ID, addr);

            IWallet.Note memory note = IWallet.Note(
                addr.h1X,
                addr.h2X,
                i,
                uint256(uint160(address(token))),
                ERC20_ID,
                100
            );
            uint256 noteCommitment = treeTest.computeNoteCommitment(note);

            batch[i] = noteCommitment;
        }

        uint256[] memory path = treeTest.computeInitialRoot(batch);
        uint256 root = path[path.length - 1];

        // fill the tree batch
        wallet.fillBatchWithZeros();

        wallet.applySubtreeUpdate(root, dummyProof());
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

        uint256 root = wallet.root();
        IWallet.NoteTransmission memory newNoteATransmission = IWallet
            .NoteTransmission({
                owner: IWallet.NocturneAddress({
                    h1X: uint256(123),
                    h1Y: uint256(123),
                    h2X: uint256(123),
                    h2Y: uint256(123)
                }),
                encappedKey: uint256(111),
                encryptedNonce: uint256(111),
                encryptedValue: uint256(111)
            });
        IWallet.NoteTransmission memory newNoteBTransmission = IWallet
            .NoteTransmission({
                owner: IWallet.NocturneAddress({
                    h1X: uint256(123),
                    h1Y: uint256(123),
                    h2X: uint256(123),
                    h2Y: uint256(123)
                }),
                encappedKey: uint256(111),
                encryptedNonce: uint256(111),
                encryptedValue: uint256(111)
            });
        IWallet.JoinSplitTransaction memory joinSplitTx = IWallet
            .JoinSplitTransaction({
                commitmentTreeRoot: root,
                nullifierA: uint256(182),
                nullifierB: uint256(183),
                newNoteACommitment: uint256(1038),
                newNoteATransmission: newNoteATransmission,
                newNoteBCommitment: uint256(1032),
                newNoteBTransmission: newNoteBTransmission,
                proof: dummyProof(),
                asset: address(token),
                id: ERC20_ID,
                publicSpend: uint256(50)
            });

        address[] memory spendTokens = new address[](1);
        spendTokens[0] = address(token);
        address[] memory refundTokens = new address[](1);
        refundTokens[0] = address(token);
        IWallet.Tokens memory tokens = IWallet.Tokens({
            spendTokens: spendTokens,
            refundTokens: refundTokens
        });

        IWallet.JoinSplitTransaction[]
            memory joinSplitTxs = new IWallet.JoinSplitTransaction[](1);
        joinSplitTxs[0] = joinSplitTx;
        IWallet.Action[] memory actions = new IWallet.Action[](1);
        actions[0] = transferAction;
        IWallet.Operation memory op = IWallet.Operation({
            joinSplitTxs: joinSplitTxs,
            refundAddr: defaultNocturneAddress(),
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

        // check all values
        vm.expectEmit(true, true, false, true);
        emit JoinSplit(
            joinSplitTx.nullifierA,
            joinSplitTx.nullifierB,
            16, // newNoteAIndex
            17, // newNoteBIndex
            joinSplitTx
        );

        wallet.processBundle(bundle);

        assertEq(token.balanceOf(address(wallet)), uint256(0));
        assertEq(token.balanceOf(address(vault)), uint256(750));
        assertEq(token.balanceOf(address(ALICE)), uint256(200));
        assertEq(token.balanceOf(address(BOB)), uint256(50));
    }
}
