// //SPDX-License-Identifier: Unlicense
// pragma solidity ^0.8.0;

// import {IPoseidonT3, IPoseidonT4, IPoseidonT5, IPoseidonT6, IPoseidonT7} from "../interfaces/IPoseidon.sol";
// import "hardhat/console.sol";

// contract PoseidonGas {
//     function t3(uint256[2] calldata input) public {
//         uint256 gasStart = gasleft();
//         PoseidonT3.poseidon(input);
//         console.log("Gas after hash:", gasStart - gasleft());
//     }

//     function t4(uint256[3] calldata input) public {
//         uint256 gasStart = gasleft();
//         PoseidonT4.poseidon(input);
//         console.log("Gas after hash:", gasStart - gasleft());
//     }

//     function t5(uint256[4] calldata input) public {
//         uint256 gasStart = gasleft();
//         PoseidonT5.poseidon(input);
//         console.log("Gas after hash:", gasStart - gasleft());
//     }

//     function t6(uint256[5] calldata input) public {
//         uint256 gasStart = gasleft();
//         PoseidonT6.poseidon(input);
//         console.log("Gas after hash:", gasStart - gasleft());
//     }

//     function t7(uint256[6] calldata input) public {
//         uint256 gasStart = gasleft();
//         PoseidonT7.poseidon(input);
//         console.log("Gas after hash:", gasStart - gasleft());
//     }
// }
