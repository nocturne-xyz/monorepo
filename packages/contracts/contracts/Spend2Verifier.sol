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
pragma solidity ^0.8.2;

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
                21343536394626053547943434457517501786957074385845012709720562508763895763762,
                17166723507255790247196660181043164408236020969725074545474244117527625313245
            ],
            [
                578134601486881900800568269098758662119858926284307217169197202628777069503,
                1098842193466665818255276451687166500782742175390563488234976487603355055120
            ]
        );
        vk.IC = new Pairing.G1Point[](8);

        vk.IC[0] = Pairing.G1Point(
            14907153069947814598208580708145206400141918080305398679260205297169768594461,
            7808679640546757183254959224156740435125571065959340538491792622840233630880
        );

        vk.IC[1] = Pairing.G1Point(
            19808093520679877195797148791506451675512776122629370177759114599051731289568,
            5617703832017698527260216648180778018669885577820516382049838874191626543234
        );

        vk.IC[2] = Pairing.G1Point(
            13342660491713056001318195268277415214692294122718585205173036141337983773521,
            10357518742197954469290202312367217390198124895828235957238981566849009534476
        );

        vk.IC[3] = Pairing.G1Point(
            1691386260155362482876379695110061612008445253956213889830337739323407979339,
            17787419145982947589643923462640076845205734346770133767828806140251663633396
        );

        vk.IC[4] = Pairing.G1Point(
            9448594328799549102375161561723607341799089531249648185340083069213584655271,
            18608199233811478130113259042194738905804857643924040007299308812270206290457
        );

        vk.IC[5] = Pairing.G1Point(
            5078556255295263719298833177152328296034009438715164108212665493852355165852,
            12907693995962309784580835262381855334075502496453328909071706822537484891024
        );

        vk.IC[6] = Pairing.G1Point(
            18381004446937456075121376931579598702607323913533856318901081907692661704737,
            2908397689434277637772192575146122535429942426357837921601383804556822081144
        );

        vk.IC[7] = Pairing.G1Point(
            17841987920210493695111575818980400494370219844134713881418291772005049603004,
            9972199944925924356687465048409694131316241214662862040400639946973794110920
        );
    }

    function verify(uint256[] memory input, Proof memory proof)
        internal
        view
        returns (uint256)
    {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length, "verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint256 i = 0; i < input.length; i++) {
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
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[7] memory input
    ) public view override returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint256[] memory inputValues = new uint256[](input.length);
        for (uint256 i = 0; i < input.length; i++) {
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
