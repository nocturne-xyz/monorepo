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
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";
import {Pairing} from "./libs/Pairing.sol";

contract JoinSplitVerifier is IJoinSplitVerifier {
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
                11146849551365826414064052812714784537011828103868611358624322209379880503316,
                3839632569455698028046779503343935753632837214643095663213444214856697258162
            ],
            [
                8365152630982314860956898925236971675275459930624844805383120316320954792126,
                9164470545188016753561605224004549065591634389021098647697286192880742723278
            ]
        );
        vk.IC = new Pairing.G1Point[](10);

        vk.IC[0] = Pairing.G1Point(
            20151672619746647644645471822801710296510922505593796521592586631798406418574,
            18666048490706855485448029907451216082438209482118242151562107507823137171571
        );

        vk.IC[1] = Pairing.G1Point(
            19403612607702369220833506949717341942818937126242762586725153214747628916303,
            18032679947958822617565987306308928017225456917661779243799543069221570290593
        );

        vk.IC[2] = Pairing.G1Point(
            14932665881412744510133198855549642300647508204038804108287969503238790086039,
            14108683547864935168877327260058104843615127146571902382817499930018480681113
        );

        vk.IC[3] = Pairing.G1Point(
            15882885027594724301104222082885039925809032152053225822608369668395108221312,
            17643231299015441154285627315429668522354290413203877145054597066507319096029
        );

        vk.IC[4] = Pairing.G1Point(
            20360163428079553921298314450370942983087950011232883403474799568967946069064,
            20418541320549237648261150120648753678729190749536315145291252462793144264924
        );

        vk.IC[5] = Pairing.G1Point(
            13601425720405018668571320693760047675456577391870467860628416790648961173230,
            19289352789556407988814300263122226941082044785565312436778486019560275914247
        );

        vk.IC[6] = Pairing.G1Point(
            20728782752097203018004460774131170046567144857178081255198489505122990392667,
            16629899483006091220109353540728465889430304380102976760866765602410980418139
        );

        vk.IC[7] = Pairing.G1Point(
            21087447917113851153381100681015534038106316795950225602467001579814299025338,
            15771464255569164181151020328290591048943035419103462186581212313469019531416
        );

        vk.IC[8] = Pairing.G1Point(
            15456702252488423200513732028642479036475178004260943581195976850652136567232,
            20990274016522948749971875309198636111839663537962220068630659018857544320525
        );

        vk.IC[9] = Pairing.G1Point(
            14262784021868371621379956345802841467406084287718356673092618132881039808347,
            5019656329431479025355579032812518500548476715886156578171601100493162813276
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
        uint[9] memory input
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
