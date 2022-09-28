// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {IPoseidonT3, IPoseidonT4, IPoseidonT6} from "../interfaces/IPoseidon.sol";
import {TestVerifier} from "./utils/TestVerifier.sol";
import {Vault} from "../Vault.sol";
import {Wallet} from "../Wallet.sol";
import {HexUtils} from "./utils/HexUtils.sol";
import {SimpleERC20Token} from "./tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "./tokens/SimpleERC721Token.sol";

contract WalletTest is Test {
    using stdJson for string;

    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant ALICE = address(1);

    Wallet wallet;
    Vault vault;
    IVerifier verifier;
    IPoseidonT3 poseidonT3;
    IPoseidonT4 poseidonT4;
    IPoseidonT6 poseidonT6;
    SimpleERC20Token[3] ERC20s;
    SimpleERC721Token[3] ERC721s;

    function defaultFlaxAddress()
        internal
        pure
        returns (IWallet.FLAXAddress memory)
    {
        return IWallet.FLAXAddress({H1: 1938477, H2: 9104058, H3: 103048217});
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

    function setUp() public virtual {
        // Deploy poseidon hasher libraries
        string memory root = vm.projectRoot();
        address[4] memory poseidonAddrs;
        for (uint8 i = 0; i < 4; i++) {
            bytes memory path = string.concat(
                bytes(root),
                "/packages/contracts/poseidonBytecode/PoseidonT"
            );
            path = string.concat(path, bytes(Strings.toString(i + 3)));
            path = string.concat(path, ".txt");

            string memory bytecodeStr = vm.readFile(string(path));
            bytes memory bytecode = HexUtils.hexToBytes(bytecodeStr);

            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            poseidonAddrs[i] = deployed;
        }

        poseidonT3 = IPoseidonT3(poseidonAddrs[0]);
        poseidonT4 = IPoseidonT4(poseidonAddrs[1]);
        poseidonT6 = IPoseidonT6(poseidonAddrs[3]);

        // Instantiate vault, verifier, and wallet
        vault = new Vault();
        verifier = new TestVerifier();
        wallet = new Wallet(
            address(vault),
            address(verifier),
            address(poseidonT3),
            address(poseidonT4),
            address(poseidonT6)
        );

        vault.initialize(address(wallet));

        // Instantiate token contracts
        for (uint256 i = 0; i < 3; i++) {
            ERC20s[i] = new SimpleERC20Token();
            ERC721s[i] = new SimpleERC721Token();
        }
    }

    function testPoseidon() public {
        console.log(poseidonT3.poseidon([uint256(0), uint256(1)]));
        console.log(poseidonT4.poseidon([uint256(0), uint256(1), uint256(2)]));
        console.log(
            poseidonT6.poseidon(
                [uint256(0), uint256(1), uint256(2), uint256(3), uint256(4)]
            )
        );
    }

    function testProcessOneBundle() public {
        SimpleERC20Token token = ERC20s[0];
        token.reserveTokens(ALICE, 1000);

        vm.prank(ALICE);
        token.approve(address(vault), 800);

        for (uint256 i = 0; i < 8; i++) {
            vm.prank(ALICE);
            depositFunds(
                wallet,
                ALICE,
                address(token),
                100,
                ERC20_ID,
                defaultFlaxAddress()
            );
        }

        wallet.commit8FromQueue();

        bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));
        bytes memory encodedFunction = abi.encodeWithSelector(
            selector,
            ALICE,
            100
        );
        IWallet.Action memory transfer = IWallet.Action({
            contractAddress: address(token),
            encodedFunction: encodedFunction
        });
    }
}
