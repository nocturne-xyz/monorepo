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
import {ISubtreeUpdateVerifier} from "./interfaces/ISubtreeUpdateVerifier.sol";
import {Pairing} from "./libs/Pairing.sol";
import {BatchVerifier} from "./libs/BatchVerifier.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";

contract SubtreeUpdateVerifier is ISubtreeUpdateVerifier {
    using Pairing for *;

    function verifyingKey()
        internal
        pure
        returns (IVerifier.VerifyingKey memory vk)
    {
        vk.alpha1 = Pairing.G1Point(
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
                20982740898175791991495983987857085770426606771988608689973536200514960704278,
                16230403929903199002213691148035795871020286437662046814473513458528330080854
            ],
            [
                10944084562148035678313884880730141058194572693711617446883569919384462138217,
                16812161972733117025321508482363121699342797998240361248267230558679611286097
            ]
        );
        vk.IC = new Pairing.G1Point[](5);

        vk.IC[0] = Pairing.G1Point(
            16825608841317698928196671617041991524953052347808794228630874336619253620556,
            20001825909805212425993277562010771422441303751503179352059675822038419931533
        );

        vk.IC[1] = Pairing.G1Point(
            364311541749241346434202442584096599318694825904501301641537732695522294302,
            981845141839110878783799887260210853282469146605121379887906821469026365341
        );

        vk.IC[2] = Pairing.G1Point(
            4944121457981191361832204167265026550167067343433679815200041681625931869177,
            19787564930566513040839634800866657189811760020335361945568984493909878373847
        );

        vk.IC[3] = Pairing.G1Point(
            17726966193949809196421870732291084784490989141326466572853394589723993825152,
            19107234496360392328520896957656395743774900988511703211176388360718477588786
        );

        vk.IC[4] = Pairing.G1Point(
            21000936559158219546731622898894958724626538240941706505162534170850461566068,
            10078752078522298066360435537787664796307595073263420116923649770495185434986
        );
    }

    function verify(
        uint[] memory input,
        IVerifier.Proof memory proof
    ) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        IVerifier.VerifyingKey memory vk = verifyingKey();
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
                vk.alpha1,
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
        IVerifier.Proof memory proof,
        uint256[] memory pis
    ) public view override returns (bool r) {
        if (verify(pis, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        IVerifier.Proof[] memory proofs,
        uint256[] memory pisFlat
    ) public view override returns (bool) {
        return BatchVerifier.batchVerifyProofs(verifyingKey(), proofs, pisFlat);
    }
}
