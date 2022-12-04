//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.5;
import {ISpend2Verifier} from "./interfaces/ISpend2Verifier.sol";
import {Pairing} from "./libs/Pairing.sol";

contract Spend2Verifier is ISpend2Verifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [
                4252822878758300859123897981450591353533073413197771768651442665752259397132,
                6375614351688725206403948262868962793625744043794305715222011528459656738731
            ],
            [
                21847035105528745403288232691147584728191162732299865338377159692350059136679,
                10505242626370262277552901082094356697409835680220590971873171140371331206856
            ]
        );
        vk.gamma2 = Pairing.G2Point(
            [
                11559732032986387107991004021392285783925812861821192530917403151452391805634,
                10857046999023057135944570762232829481370756359578518086990519993285655852781
            ],
            [
                4082367875863433681332203403145435568316851327593401208105741076214120093531,
                8495653923123431417604973247489272438418190587263600148770280649306958101930
            ]
        );
        vk.delta2 = Pairing.G2Point(
            [
                12461465456286179656844612591503240183341309807138771780162118805910710578691,
                4089074002947894269045773050991042106196861305857843653476384746435901748434
            ],
            [
                4472173052286759968853623399284544959591839966262044821887149520218355547146,
                3053849711849159346459918999313395405391228036680614091224653947720442959958
            ]
        );
        vk.IC = new Pairing.G1Point[](8);

        vk.IC[0] = Pairing.G1Point(
            180449857285499796469202021619795921099702775130233130273200695667592354018,
            10076928747655699927621044322220896420989343884398484224836352740985102317959
        );

        vk.IC[1] = Pairing.G1Point(
            12581945527354576970383307505051564546820062040233820655244815093153402098542,
            1459845562834290806522358743669790660712538664544761672335759031995903062565
        );

        vk.IC[2] = Pairing.G1Point(
            3737953556059329385572325983339294851568042380772619489615930362350659979207,
            7296824919396942955971840910067865420210797262675636223861109385302177775030
        );

        vk.IC[3] = Pairing.G1Point(
            8817040582963458624379468110048238325294280757717437157101059897560925821525,
            19298762733859887534440277955042688451091998769191433025878800997105016293249
        );

        vk.IC[4] = Pairing.G1Point(
            19206629200899310442557942796274206335587896143460455953008377244043939887465,
            18019892405774503318651841517110561518446069166022821289327742681419588931211
        );

        vk.IC[5] = Pairing.G1Point(
            11208810482901448653525390096976167796827280355241518897004197290311609589570,
            17064021756650609643488870632775972643784240302084705886209979125564840975117
        );

        vk.IC[6] = Pairing.G1Point(
            11485634018843947240130053504944963705320029046050421100757590697690850670902,
            16047218049193477215961110828927522008815148448869423647047711374789772144767
        );

        vk.IC[7] = Pairing.G1Point(
            12698453196349933085202623697046739710709067319858055873548515278930554763108,
            6196584629368500495735942145744659941058319922050193290875764364301187164958
        );
    }

    function verify(
        uint[] memory input,
        Proof memory proof
    ) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length, "verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(
                input[i] < snark_scalar_field,
                "verifier-gte-snark-scalar-field"
            );
            vk_x = Pairing.addition(
                vk_x,
                Pairing.scalar_mul(vk.IC[i + 1], input[i])
            );
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (
            !Pairing.pairingProd4(
                Pairing.negate(proof.A),
                proof.B,
                vk.alfa1,
                vk.beta2,
                vk_x,
                vk.gamma2,
                proof.C,
                vk.delta2
            )
        ) return 1;
        return 0;
    }

    /// @return r  bool true if proof is valid
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[7] memory input
    ) public view override returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for (uint i = 0; i < input.length; i++) {
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
