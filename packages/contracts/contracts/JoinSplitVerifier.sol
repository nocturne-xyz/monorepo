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
                5502476367677170400961428478476738220384244299363397700815703671658168684735,
                3506681284625574819815049919862547556516506739750101891416849508247473270433
            ],
            [
                19911779734121241081123837685684306108628613009811573022401653264548764302384,
                21047462083448908457451403641733877859482877077627444213724838277967795360253
            ]
        );
        vk.IC = new Pairing.G1Point[](12);

        vk.IC[0] = Pairing.G1Point(
            14144020851981313197090654194400793949881109141939767666644553948275343452588,
            10470662614609593119604601597315394752583390635872294567344320144310659203767
        );
        vk.IC[1] = Pairing.G1Point(
            11018479467834915369394305840585693455426717925977164473741215572307153697017,
            3024780472655494068876648646016089130417570338237612299666301285563059043528
        );
        vk.IC[2] = Pairing.G1Point(
            8934943740646655957703982238365131557437634186778506756277563805546499601254,
            7533330841239569655757017333394837862907789749920988036431828259011120805037
        );
        vk.IC[3] = Pairing.G1Point(
            2666346966718162469861622378162644044839416152498852543739357133630896676410,
            7226911295463017438858320090290443661121807883011388805169050270622718964457
        );
        vk.IC[4] = Pairing.G1Point(
            488358096016077482682562629304219875464818148597825115519023094645445268839,
            19580818487516127826336203994368588842013576307773223824660013466867913459369
        );
        vk.IC[5] = Pairing.G1Point(
            19188289070886178779457880922446841201010283709589133607100605231922721819136,
            15452542671564987962247130905817306083158095997213821571677325902049490890419
        );
        vk.IC[6] = Pairing.G1Point(
            9561244917535683385117795331295777324982008054806208260185152218138798921716,
            19227382046531152562800120114500274576916146037388305222924193185194392877294
        );
        vk.IC[7] = Pairing.G1Point(
            8274992230721916872169526188117325882138399851146580167776337840060396855551,
            18499600163383913318038971240596959607350440955350304996252359743324344955909
        );
        vk.IC[8] = Pairing.G1Point(
            15555428925724304225871716247221858636824714752136548564921426023720775531638,
            8693961265803085773687122575095567600417652996060371301121324609797111162997
        );
        vk.IC[9] = Pairing.G1Point(
            10610685356162208790653200439187446969430216773116442043250866484671394553126,
            19643147936268779511960599642780999237586435288879058769568074867618269015252
        );
        vk.IC[10] = Pairing.G1Point(
            3056828197680802419764291833123357910990999671935449263142280528779821577320,
            7989212706039160398399815895752873192491073277766757898462304921538772303344
        );
        vk.IC[11] = Pairing.G1Point(
            15850361063712965148117776219247526287691401575273169634913015728569356294535,
            259084076791033554791742022053304408662386358204749161608637738306236474873
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
