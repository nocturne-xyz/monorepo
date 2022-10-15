// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {ISpend2Verifier} from "../interfaces/ISpend2Verifier.sol";
import {IBatchMerkle} from "../interfaces/IBatchMerkle.sol";
import {PoseidonHasherT3, PoseidonHasherT5, PoseidonHasherT6} from "../PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../interfaces/IHasher.sol";
import {IPoseidonT3} from "../interfaces/IPoseidon.sol";
import {PoseidonBatchBinaryMerkle} from "../PoseidonBatchBinaryMerkle.sol";
import {Spend2Verifier} from "../Spend2Verifier.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {TestUtils} from "./utils/TestUtils.sol";
import {JsonDecodings, Spend2ProofWithPublicSignals} from "./utils/JsonDecodings.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";

contract ConnectedWalletTest is Test, TestUtils, JsonDecodings {
    using stdJson for string;

    string constant E2E_FIXTURE_PATH = "/fixtures/spend2ProofE2E.json";
    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant ALICE = address(1);
    address constant BOB = address(2);
    address constant TOKEN = address(3);

    Wallet wallet;
    Vault vault;
    IBatchMerkle merkle;
    ISpend2Verifier verifier;
    IHasherT3 hasherT3;
    IHasherT5 hasherT5;
    IHasherT6 hasherT6;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;

    function defaultFlaxAddress()
        internal
        pure
        returns (IWallet.FLAXAddress memory)
    {
        return
            IWallet.FLAXAddress({
                H1X: 1938477,
                H1Y: 9104058,
                H2X: 1032988,
                H2Y: 1032988
            });
    }

    function defaultSpendProof()
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

        bytes memory code = address(ERC20s[0]).code;
        vm.etch(TOKEN, code);
        token.approve(address(vault), 800);

        // // Deposit funds to vault
        // for (uint256 i = 0; i < 8; i++) {
        //     vm.prank(ALICE);
        //     depositFunds(
        //         wallet,
        //         ALICE,
        //         address(token),
        //         100,
        //         ERC20_ID,
        //         defaultFlaxAddress()
        //     );
        // }
    }

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        string memory root = vm.projectRoot();
        address[4] memory poseidonAddrs;
        for (uint8 i = 0; i < 4; i++) {
            bytes memory path = abi.encodePacked(
                bytes(root),
                "/packages/contracts/poseidon-bytecode/PoseidonT"
            );
            path = abi.encodePacked(path, bytes(Strings.toString(i + 3)));
            path = abi.encodePacked(path, ".txt");

            string memory bytecodeStr = vm.readFile(string(path));
            bytes memory bytecode = hexToBytes(bytecodeStr);

            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            poseidonAddrs[i] = deployed;
        }

        hasherT3 = IHasherT3(new PoseidonHasherT3(poseidonAddrs[0]));
        hasherT5 = IHasherT5(new PoseidonHasherT5(poseidonAddrs[2]));
        hasherT6 = IHasherT6(new PoseidonHasherT6(poseidonAddrs[3]));

        // Instantiate vault, verifier, tree, and wallet
        vault = new Vault();
        merkle = new PoseidonBatchBinaryMerkle(
            32,
            0,
            IPoseidonT3(address(hasherT3))
        );
        verifier = new Spend2Verifier();
        wallet = new Wallet(
            address(vault),
            address(verifier),
            address(merkle),
            address(hasherT5),
            address(hasherT6)
        );

        vault.initialize(address(wallet));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
        }

        bytes memory code = address(ERC20s[0]).code;
        vm.etch(TOKEN, code);
    }

    // function testConnectedTransferNoRefund() public {
    //     SimpleERC20Token token = SimpleERC20Token(TOKEN);
    //     aliceDepositFunds(token);

    // wallet.commit8FromQueue();

    // // Create transaction to withdraw 100 token from vault and transfer
    // // to bob
    // bytes memory encodedFunction = abi.encodeWithSelector(
    //     token.transfer.selector,
    //     BOB,
    //     100
    // );
    // IWallet.Action memory transferAction = IWallet.Action({
    //     contractAddress: address(token),
    //     encodedFunction: encodedFunction
    // });

    // Spend2ProofWithPublicSignals memory proof = loadSpend2ProofFromFixture(
    //     E2E_FIXTURE_PATH
    // );
    // uint256[8] memory proof8 = spend2BaseProofToProof8(proof.proof);

    // uint256 root = wallet.getRoot();
    // IWallet.SpendTransaction memory spendTx = IWallet.SpendTransaction({
    //     commitmentTreeRoot: root,
    //     nullifier: uint256(
    //         15761417917235091624901806773185757219566938375261539748265784699845827932435
    //     ),
    //     newNoteCommitment: uint256(
    //         3835679327082170393206725766989606448441531961099962628039819703386065832278
    //     ),
    //     proof: proof8,
    //     value: uint256(100),
    //     asset: address(token),
    //     id: ERC20_ID
    // });

    // address[] memory spendTokens = new address[](1);
    // spendTokens[0] = address(token);
    // address[] memory refundTokens = new address[](0);
    // IWallet.Tokens memory tokens = IWallet.Tokens({
    //     spendTokens: spendTokens,
    //     refundTokens: refundTokens
    // });

    // IWallet.SpendTransaction[]
    //     memory spendTxs = new IWallet.SpendTransaction[](1);
    // spendTxs[0] = spendTx;
    // IWallet.Action[] memory actions = new IWallet.Action[](1);
    // actions[0] = transferAction;
    // IWallet.Operation memory op = IWallet.Operation({
    //     spendTxs: spendTxs,
    //     refundAddr: defaultFlaxAddress(),
    //     tokens: tokens,
    //     actions: actions,
    //     gasLimit: DEFAULT_GAS_LIMIT
    // });

    // IWallet.Operation[] memory ops = new IWallet.Operation[](1);
    // ops[0] = op;
    // IWallet.Bundle memory bundle = IWallet.Bundle({operations: ops});

    // // Ensure 100 tokens have changed hands
    // assertEq(token.balanceOf(address(wallet)), uint256(0));
    // assertEq(token.balanceOf(address(vault)), uint256(800));
    // assertEq(token.balanceOf(address(ALICE)), uint256(200));
    // assertEq(token.balanceOf(address(BOB)), uint256(0));

    // wallet.processBundle(bundle);

    // assertEq(token.balanceOf(address(wallet)), uint256(0));
    // assertEq(token.balanceOf(address(vault)), uint256(700));
    // assertEq(token.balanceOf(address(ALICE)), uint256(200));
    // assertEq(token.balanceOf(address(BOB)), uint256(100));
    // }
}
