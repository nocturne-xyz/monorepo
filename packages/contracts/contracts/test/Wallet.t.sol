// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";

import {IWallet} from "../interfaces/IWallet.sol";
import {IPoseidonT4} from "../interfaces/IPoseidon.sol";
import {Wallet} from "../Wallet.sol";

contract WalletTest is Test {
    using stdJson for string;

    uint256 constant DEFAULT_GAS_LIMIT = 10000000;
    uint256 constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant ERC20_ID = SNARK_SCALAR_FIELD - 1;

    address constant POSEIDON_T4_ADDRESS = address(1);

    Wallet wallet;
    IPoseidonT4 poseidonT4 = IPoseidonT4(POSEIDON_T4_ADDRESS);

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
        bytes memory path = string.concat(
            bytes(root),
            "/poseidonInterfaces/PoseidonT4Bytecode.txt"
        );
        string memory t4Bytecode = vm.readFile(string(path));
        vm.etch(POSEIDON_T4_ADDRESS, bytes(t4Bytecode));
    }
}
