// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ParseUtils} from "./ParseUtils.sol";

contract PoseidonDeployer is Test {
    address poseidonT3;
    address poseidonT4;
    address poseidonT5;
    address poseidonT6;

    address poseidonExtT3;
    address poseidonExtT4;
    address poseidonExtT7;

    function deployPoseidon3Through6() public {
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
            bytes memory bytecode = ParseUtils.hexToBytes(bytecodeStr);

            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            poseidonAddrs[i] = deployed;
        }

        poseidonT3 = poseidonAddrs[0];
        poseidonT4 = poseidonAddrs[1];
        poseidonT5 = poseidonAddrs[2];
        poseidonT6 = poseidonAddrs[3];
    }

    function deployPoseidonExts() public {
        string memory root = vm.projectRoot();
        address[3] memory poseidonAddrs;

        uint8[3] memory widths = [3, 4, 7];

        for (uint256 i = 0; i < 3; i++) {
            bytes memory path = abi.encodePacked(
                bytes(root),
                "/packages/contracts/poseidon-bytecode/PoseidonExtT"
            );
            path = abi.encodePacked(path, bytes(Strings.toString(widths[i])));
            path = abi.encodePacked(path, ".txt");

            string memory bytecodeStr = vm.readFile(string(path));
            bytes memory bytecode = ParseUtils.hexToBytes(bytecodeStr);

            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            poseidonAddrs[i] = deployed;
        }

        poseidonExtT3 = poseidonAddrs[0];
        poseidonExtT4 = poseidonAddrs[1];
        poseidonExtT7 = poseidonAddrs[2];
    }
}
