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
import {IJoinsplitVerifier} from "./interfaces/IJoinsplitVerifier.sol";
import {Pairing} from "./libs/Pairing.sol";

contract JoinsplitVerifier is IJoinsplitVerifier {
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
                3430630060653912441866730717173175543132866358923666785052718703150505879903,
                4773646557598007801793033289151323355978601132069675374925330428127485576747
            ],
            [
                4394948353562578401709868618048513659563799580629429134867998032214101428487,
                15439516117364900685739156747444305823612796291848677023047709214258352863897
            ]
        );
        vk.IC = new Pairing.G1Point[](10);

        vk.IC[0] = Pairing.G1Point(
            18542642180763779000765639257028864010616851841473493328134531146046003663250,
            4926360678995811833653633975692253485442419204539045529578925650772386460810
        );

        vk.IC[1] = Pairing.G1Point(
            3801548240067687276740596364937805504104231428125069940232644808572140797841,
            2865473122748147470994622968702303130513305300056522822825357402135956039966
        );

        vk.IC[2] = Pairing.G1Point(
            15038983296325985770682738913131598820474874785405880714370084425535585421125,
            11860463778349951263487947410314130167939745044721371190185527338478021186075
        );

        vk.IC[3] = Pairing.G1Point(
            1533442231853368559863653169999199057821682129268701268102178765517424856336,
            20691806684696374803120384839007307130896911450290068916958047368932880035390
        );

        vk.IC[4] = Pairing.G1Point(
            1273708792292571795239557688579794273607298530530456644271176495206682785641,
            9556791489398338309471469677264493442529108849448386691826265138811462285248
        );

        vk.IC[5] = Pairing.G1Point(
            1329557352964254838531778256980336387621805858967732221425004628483050450039,
            18932815314873347344993985454895790232350593071225297205653827066387010585310
        );

        vk.IC[6] = Pairing.G1Point(
            21836399484716710785728718934902882195295199657828523415639735185802497642339,
            17911490788804384827680131227568733383465770024531653598205472624291529970567
        );

        vk.IC[7] = Pairing.G1Point(
            10544239123045081610685672425724997043080778510934584565411227163077946099462,
            4393442608038865229830108291564507321884900202071009462697629958572592795910
        );

        vk.IC[8] = Pairing.G1Point(
            18868030840234315993995283061301489120268452883947761631392325588792489058323,
            7598080446846798542382580037364478227792724774349744792023922619939544052672
        );

        vk.IC[9] = Pairing.G1Point(
            921684985616721664560266613516443744158843242411043696503045139397555827542,
            21024408173946396424100105012869259983165142023480959556778615629313745541195
        );
    }

    function verify(
        uint256[] memory input,
        Proof memory proof
    ) internal view returns (uint256) {
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
        uint256[9] memory input
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
