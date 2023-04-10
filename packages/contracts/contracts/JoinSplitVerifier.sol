// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";

contract JoinSplitVerifier is IJoinSplitVerifier {
    function verifyingKey()
        internal
        pure
        returns (Groth16.VerifyingKey memory vk)
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
                1389192843145750110180651995606329696743762874387476340522673193701363556370,
                20835265177753632983351478504642551246263756318652922978192501930455854663350
            ],
            [
                18135519512726600867780873553605075687333140302958734255633983579734701316119,
                14984046853266734673525292931141990890665723832625838691147660679687348583279
            ]
        );
        vk.IC = new Pairing.G1Point[](12);

        vk.IC[0] = Pairing.G1Point(
            4570030184781763358932337061111729993614763004727755183719711372774407528238,
            12684224962347506602143686529004249210327507423781132303946754543291430050542
        );

        vk.IC[1] = Pairing.G1Point(
            17034259214045501129488670734468757377969587792072474332745624951556240882874,
            20575201020105044856942899601758773278189813396495531369891919817962272691959
        );

        vk.IC[2] = Pairing.G1Point(
            10453241313399776544183699712431762144753913317890905113829493650881962101686,
            15050183592843034085927300564947343422543931072441470399201583828409788244502
        );

        vk.IC[3] = Pairing.G1Point(
            13883049912007925282645536989053498214185748328175801580455345662271339995780,
            18254239950297988013761307692052518794094311875746593903713738178907134884850
        );

        vk.IC[4] = Pairing.G1Point(
            1665663650814903094691529594248270077232101083170351668466347537586305247169,
            15206691822320550509133914515276108864175235217488512496618326912928683999079
        );

        vk.IC[5] = Pairing.G1Point(
            4734198158242687703313148919151823752278790169987232748864616150133255802962,
            15763048778736135077210733994646666704541868058536165434964801718005028240608
        );

        vk.IC[6] = Pairing.G1Point(
            17565013618764161868385697492087182165113803998918040275242591709966460340404,
            436255260963945445106667693648103978432680384720938825926660253481478412926
        );

        vk.IC[7] = Pairing.G1Point(
            9686753897728311546966070991793674702873302656986609423864004939823623343973,
            5887471142165059578382905734114093625519163821523451719170707909631542503188
        );

        vk.IC[8] = Pairing.G1Point(
            6761436603663426665301135620953830034192455825936943689846147348522030531193,
            13060237241293874282367067879993273215957015324975566970692648727491924784103
        );

        vk.IC[9] = Pairing.G1Point(
            7121174320901475957974275428262045347975672241464700433954083885557952396685,
            7320066652456397436496110592078706002345348030424843816309889344939515515005
        );

        vk.IC[10] = Pairing.G1Point(
            15171012630309776863888400436064162778009407515185578773864324172308543054255,
            1281384250531993451666683027923388139302979090308150400446387824961364148785
        );

        vk.IC[11] = Pairing.G1Point(
            13747860713470096760127489106828937228729749843141872317754133247022884300919,
            16039847128249221730317680500262067895825109964840202774436158777309473545102
        );
    }

    /// @return r  bool true if proof is valid
    function verifyProof(
        uint256[8] memory proof,
        uint256[] memory pi
    ) public view override returns (bool r) {
        return Groth16.verifyProof(verifyingKey(), proof, pi);
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        uint256[8][] memory proofs,
        uint256[][] memory allPis
    ) public view override returns (bool) {
        return Groth16.batchVerifyProofs(verifyingKey(), proofs, allPis);
    }
}
