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
                3830917310283487988974518525334032823185784866309314111986926749228261973488,
                2787949030298357745326688139544630380995872307796377585372536420367398634409
            ],
            [
                8651392995836922042397806052096976224486208598184464278557721102400060866088,
                4965686743945884968304159246083100157385385363680361775585881477339376718056
            ]
        );
        vk.IC = new Pairing.G1Point[](12);

        vk.IC[0] = Pairing.G1Point(
            6689787577610426604767927404932906073152005122255775973405263167966516837644,
            14406768676022848837902886849653012666753564025574062744947698458442560559479
        );

        vk.IC[1] = Pairing.G1Point(
            15145376831964820570547041930552253133577863400665154645871768115361997858216,
            13638342941430516895083188254509241085006946898516091753943307326713430895265
        );

        vk.IC[2] = Pairing.G1Point(
            3084477705948427801462701549364189600940361825252169096205250547427456912411,
            2627805681459920328968122754381759974828755705665246200179204546743076496457
        );

        vk.IC[3] = Pairing.G1Point(
            1956882877508675811259958517531459062191621377284385448303692393353478965263,
            4276358195309274830475884899552843090315443971087060071823960626723446950328
        );

        vk.IC[4] = Pairing.G1Point(
            18986078203228062791659211856154010582965357084360393367905668495077637514225,
            15703172420217553651276741908074964688988765612601122420570268113011957798260
        );

        vk.IC[5] = Pairing.G1Point(
            21809790547556146335201495745800362075021758056170633695597766873547987001157,
            11843979235977984336524075545024755129204148400850694868520393257205498422892
        );

        vk.IC[6] = Pairing.G1Point(
            1286254035416231750970661743245556684820475596021215582906019024020311871196,
            14401783863431309770068013606906718466264730574145833656599516730712897843963
        );

        vk.IC[7] = Pairing.G1Point(
            9969465500876223155215197826428147560402502764072527281233630546126719435719,
            7046362636656724802746202548927094193795182922713962119189221249911058490798
        );

        vk.IC[8] = Pairing.G1Point(
            9639319048902198806146395075949769115083476970403083994821169462774521334263,
            9706195982742975548480496312614438738335202102545898179036189558199122093241
        );

        vk.IC[9] = Pairing.G1Point(
            8967672628909553609893449522190208796990378708987609880327647174944338627319,
            1078222764867056390802862799313539324645153402247024779812249766832136968717
        );

        vk.IC[10] = Pairing.G1Point(
            3840499404713929076080047076819771906121002621420103800971378586724746695089,
            1922076066052804228164402089121437543082266983937172338230209677453816815131
        );

        vk.IC[11] = Pairing.G1Point(
            1028203156877143862154512969775327366377835333578717414934975910632744914183,
            5254111308599771542017673490317275774431743979462655831880605390958346411891
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
