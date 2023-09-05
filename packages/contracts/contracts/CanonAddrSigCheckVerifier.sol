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
                8293403394473099785006220829731294292309334277329635922514577348444877204455,
                773020532580825197989265700683499343769904901528688421551138914726744641180
            ],
            [
                17214381066153793863275327145188716040063142813916029058922963729943312663323,
                8044298410607931596843420349541257429151935437174909763540021311308466536301
            ]
        );
        vk.IC = new Pairing.G1Point[](3);

        vk.IC[0] = Pairing.G1Point(
            4832813700246065920361343021419859188951987917247921272000554979262446849501,
            16450982492709346235822465585897720176511819063596563345522452720051071864672
        );
        vk.IC[1] = Pairing.G1Point(
            20319267411373749280521656549635790467688687986098419353391917503577446154512,
            17574942179666147033145072864414125540440799097149046608123758211273599911170
        );
        vk.IC[2] = Pairing.G1Point(
            17449537628454795474707997846067025590393693011235612812267573590657605090044,
            16721453092532359171509851342766105079684512390183817843689473273663565221671
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
