// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {ISubtreeUpdateVerifier} from "./interfaces/ISubtreeUpdateVerifier.sol";

contract SubtreeUpdateVerifier is ISubtreeUpdateVerifier {
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
                2438549200328977364512888570497542465496672566653731177059007264695915673219,
                6718416217191417363525418081667650743510029412331821492917223139506778993113
            ],
            [
                20961216345246283548865076698410761350705656650044647608557817843796760292747,
                14373407970244636850316206620918911780940827419734357334793173581038158839338
            ]
        );
        vk.IC = new Pairing.G1Point[](5);

        vk.IC[0] = Pairing.G1Point(
            6992592967404503869562813207252593834925785914261257757945627026606113089084,
            10283781502721772955897832906563899246555732735392575715435107190298893050425
        );

        vk.IC[1] = Pairing.G1Point(
            2000466324602580039077537265088940614835922789387244581353457095844335391926,
            16029080669652056153130674695242594161752689362239434277466537106705748414110
        );

        vk.IC[2] = Pairing.G1Point(
            10123866054778097835984324565967789802829540323814170128463199791715951524191,
            9557346852360197195922539897345656321894304582632540515193145112590558585536
        );

        vk.IC[3] = Pairing.G1Point(
            2187265860407974265340188276557445293949186887163578775414771315018118267449,
            13666210946664194303409380916487931512848236341975895075099434017795629794216
        );

        vk.IC[4] = Pairing.G1Point(
            9960375902157870570177104111357265496690501389707925437996603244209392366366,
            11559752071034829091729615972544725012776926838262914886170169787175031039571
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
