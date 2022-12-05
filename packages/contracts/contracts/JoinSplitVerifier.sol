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
import {BatchVerifier} from "./libs/BatchVerifier.sol";
import {BatchVerifier} from "./libs/BatchVerifier.sol";
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
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [8394746477520035197826075694609597138024478934449928344227294602790170700736,
             21784465999710421418378106940333703102204836724692273799226353834458343327326],
            [2544326991359833463475239886761985903964161398005468647011573726035119608444,
             8805967134962600901152926465047989460133220014292849619470686405731352464508]
        );
        vk.IC = new Pairing.G1Point[](10);
        
        vk.IC[0] = Pairing.G1Point( 
            19986063471129479843454232016169495567974649681830017826541460883348293500370,
            11003652143407398051064664553823535540096657218071868348927422147193689870889
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            21647706542525731171478926147610961736898851826370945532199104370650128205344,
            19791930638587172996359763693473269090849236644619279535413035668446443866464
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            455568674420234917861110779768922338299449128720857658893420619571799076661,
            6822436194318531517210026185567959471329885212321933679112776509550934597032
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            3335443351314385218572781857402930461686478059795573536153378227433309916294,
            14735962925319325092918499970970242856307650974747100282670282876069934644083
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            20963944418994132492682920821610725138953902759258177012294705983540816585827,
            17851476169920452507942158043652177951157928133508594095423291650797088099833
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10982519099537163872447684680605686840101884362040416487037955747367717993663,
            16640584775387331460442343813391170155723831275406554836182608276708032082084
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            11459314298365421948090759454862040662939872974513083510264200641130086599927,
            5617567725408253992736925723563801843963932528584948829735862037869562910956
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            10967036588499745306808551537386032135654989655389763964902540321561316325471,
            12153267430443971868078097384854542674493828351442397380446910114893613415834
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            1626386488670941161947359008207231157155366612543668028830155009898351948618,
            19613959815547732050285399533732681432148074902547546880309465160544369724970
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            5172765070889932384229504388132983255138474456238205153343233593484333437449,
            3775258618804889722862874819771786206661430939505689277845950768624289246172
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[9] memory input
        ) public override view returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) public view override returns (bool) {
        VerifyingKey memory vk = verifyingKey();
        uint256[14] memory vkFlat = BatchVerifier.flattenVK(
            vk.alfa1,
            vk.beta2,
            vk.gamma2,
            vk.delta2
        );

        return BatchVerifier.batchVerifyProofs(vkFlat, vk.IC, proofsFlat, pisFlat, numProofs);
    }
}

