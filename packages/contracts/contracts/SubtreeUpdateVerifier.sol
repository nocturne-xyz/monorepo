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
                19542305294252911536659109540205484540388158783626858025519432202684157193344,
                14425765525294239426783010050310707250098647665768528603561925375927539555448
            ],
            [
                10865958958143165915776145899468086741725851620132142859014278055649364168902,
                4034033288035219817604006497977062338791444042124661352600696699136817195637
            ]
        );
        vk.IC = new Pairing.G1Point[](5);

        vk.IC[0] = Pairing.G1Point(
            13323275652683803874281471614999882899191172905603545325545744225357384827819,
            9914424927018133717478581040504615383508181422970980583607515021539543203300
        );

        vk.IC[1] = Pairing.G1Point(
            8318607139623649926404674882652572182834668679240891514221509797892600135946,
            539412468628308386848616989821165771982693536145227435441542819953110821722
        );

        vk.IC[2] = Pairing.G1Point(
            21123893889445089284088816991865330417381205405106149048019956896601838071598,
            657903856906240042611823792129853776830685079542692078810845943375735558860
        );

        vk.IC[3] = Pairing.G1Point(
            21584033151195615681230841396740400532421909453828593081262197779515306795220,
            5613402379982721614663847042961108672201013048803076732990992478172327993473
        );

        vk.IC[4] = Pairing.G1Point(
            21675483005088601735627080665343885708344340616182558943019817515137491073145,
            3434655892469327148419498489701400337838761890228767327307215892331671468022
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
