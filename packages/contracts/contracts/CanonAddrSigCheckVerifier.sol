// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {ICanonAddrSigCheckVerifier} from "./interfaces/ICanonAddrSigCheckVerifier.sol";

contract CanonAddrSigCheckVerifier is ICanonAddrSigCheckVerifier {
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
                9195355049373938989091506631780051791057772355717961303571701320787410672988,
                7598788679344312183422626093968211647125748703951555455024855987873898899902
            ],
            [
                12087503360442359216114851354419124504345578217157272187965735558218786022253,
                17426740750969887763037204584957003976654690828449266259339299338617580316976
            ]
        );
        vk.IC = new Pairing.G1Point[](3);

        vk.IC[0] = Pairing.G1Point(
            7057472435743853810659716581938216478488641126626736861109363314107488250404,
            15923133967891844772737482199854250192769097160303087214429873571019765667675
        );
        vk.IC[1] = Pairing.G1Point(
            20566813172994798529808238791596860643969102378564528581980011470933751466038,
            10367809399289053155263690020543624109782335344132490884270629435429655717980
        );
        vk.IC[2] = Pairing.G1Point(
            10765550061283545163718177667683751534508988694029541681772869430323687125272,
            13686525936151520243019860215582415170604069719431758355691213805358854780519
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
