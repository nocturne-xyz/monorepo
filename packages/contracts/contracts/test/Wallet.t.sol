// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {IPoseidonT3, IPoseidonT4, IPoseidonT6} from "../interfaces/IPoseidon.sol";
import {Wallet} from "../Wallet.sol";

contract WalletTest is Test {
    using stdJson for string;

    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant POSEIDON_T4_ADDRESS = address(1);

    Wallet wallet;
    IPoseidonT3 poseidonT3;
    IPoseidonT4 poseidonT4;
    IPoseidonT6 poseidonT6;

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
        string memory root = vm.projectRoot();

        address[4] memory poseidonAddrs;
        for (uint8 i = 0; i < 3; i++) {
            bytes memory path = string.concat(
                bytes(root),
                "/packages/contracts/poseidonInterfaces/PoseidonT"
            );
            path = string.concat(path, bytes(Strings.toString(i + 3)));
            path = string.concat(path, "Bytecode.txt");

            bytes memory bytecode = abi.encode(vm.readFile(string(path)));

            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            poseidonAddrs[i] = deployed;
        }

        poseidonT3 = IPoseidonT3(poseidonAddrs[0]);
        poseidonT4 = IPoseidonT4(poseidonAddrs[1]);
        poseidonT6 = IPoseidonT6(poseidonAddrs[2]);
    }

    function testIt() public {}
}
