//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "./interfaces/IVerifier.sol";
import "./Pairing.sol";

contract TestVerifier is IVerifier {
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
                12599857379517512478445603412764121041984228075771497593287716170335433683702,
                7912208710313447447762395792098481825752520616755888860068004689933335666613
            ],
            [
                11502426145685875357967720478366491326865907869902181704031346886834786027007,
                21679208693936337484429571887537508926366191105267550375038502782696042114705
            ]
        );
        vk.IC = new Pairing.G1Point[](5);

        vk.IC[0] = Pairing.G1Point(
            19918517214839406678907482305035208173510172567546071380302965459737278553528,
            7151186077716310064777520690144511885696297127165278362082219441732663131220
        );

        vk.IC[1] = Pairing.G1Point(
            690581125971423619528508316402701520070153774868732534279095503611995849608,
            21271996888576045810415843612869789314680408477068973024786458305950370465558
        );

        vk.IC[2] = Pairing.G1Point(
            16461282535702132833442937829027913110152135149151199860671943445720775371319,
            2814052162479976678403678512565563275428791320557060777323643795017729081887
        );

        vk.IC[3] = Pairing.G1Point(
            4319780315499060392574138782191013129592543766464046592208884866569377437627,
            13920930439395002698339449999482247728129484070642079851312682993555105218086
        );

        vk.IC[4] = Pairing.G1Point(
            3554830803181375418665292545416227334138838284686406179598687755626325482686,
            5951609174746846070367113593675211691311013364421437923470787371738135276998
        );
    }

    /// @dev Verifies a Semaphore proof. Reverts with InvalidProof if the proof is invalid.
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) public view {
        // If the values are not in the correct range, the Pairing contract will revert.
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);

        VerifyingKey memory vk = verifyingKey();

        // Compute the linear combination vk_x of inputs times IC
        if (input.length + 1 != vk.IC.length) revert Pairing.InvalidProof();
        Pairing.G1Point memory vk_x = vk.IC[0];
        vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[1], input[0]));
        vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[2], input[1]));
        vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[3], input[2]));
        vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[4], input[3]));

        // Check pairing
        Pairing.G1Point[] memory p1 = new Pairing.G1Point[](4);
        Pairing.G2Point[] memory p2 = new Pairing.G2Point[](4);
        p1[0] = Pairing.negate(proof.A);
        p2[0] = proof.B;
        p1[1] = vk.alfa1;
        p2[1] = vk.beta2;
        p1[2] = vk_x;
        p2[2] = vk.gamma2;
        p1[3] = proof.C;
        p2[3] = vk.delta2;
        Pairing.pairingCheck(p1, p2);
    }

    function verifyActionProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[7] memory input
    ) external view override returns (bool) {
        return true;
    }

    function verifyRefundProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[2] memory input
    ) external view override returns (bool) {
        return true;
    }

    function verifySigProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view override returns (bool) {
        return true;
    }
}
