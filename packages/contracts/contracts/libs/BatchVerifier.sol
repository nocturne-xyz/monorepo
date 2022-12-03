//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
import {Pairing} from "./Pairing.sol";
import {Utils} from "./Utils.sol";

library IBatchVerifier {

    function flattenVK(
        Pairing.G1Point memory alfa1,
        Pairing.G2Point memory beta2,
        Pairing.G2Point memory gamma2,
        Pairing.G2Point memory delta2
    ) internal pure returns (uint256[14] memory vkFlat) {
        vkFlat[0] = alfa1.X;
        vkFlat[1] = alfa1.Y;
        vkFlat[2] = beta2.X[0];
        vkFlat[3] = beta2.X[1];
        vkFlat[4] = beta2.Y[0];
        vkFlat[5] = beta2.Y[1];
        vkFlat[6] = gamma2.X[0];
        vkFlat[7] = gamma2.X[1];
        vkFlat[8] = gamma2.Y[0];
        vkFlat[9] = gamma2.Y[1];
        vkFlat[10] = delta2.X[0];
        vkFlat[11] = delta2.X[1];
        vkFlat[12] = delta2.Y[0];
        vkFlat[13] = delta2.Y[1];

        return vkFlat;
    }

    function accumulate(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) internal view returns (
        Pairing.G1Point[] memory proofAandCs,
        uint256[] memory publicInputAccumulators
    ) {
        uint256 numPublicInputs = pisFlat.length / numProofs;
        uint256[] memory entropy = new uint256[](numProofs);
        publicInputAccumulators = new uint256[](numPublicInputs + 1);

        // Generate entropy for each proof and accumulate each PI
        for (uint256 proofIndex = 0; proofIndex < numProofs; proofIndex++) {
            if (proofIndex == 0) {
                entropy[proofIndex] = 1;
            } else {
                entropy[proofIndex] = uint256(blockhash(block.number - proofIndex)) % Utils.SNARK_SCALAR_FIELD;
            }
            require(entropy[proofIndex] != 0, "Entropy should not be zero");
            // here multiplication by 1 is implied
            publicInputAccumulators[0] = addmod(publicInputAccumulators[0], entropy[proofIndex], Utils.SNARK_SCALAR_FIELD);
            for (uint256 i = 0; i < numPublicInputs; i++) {
                // accumulate the exponent with extra entropy mod Utils.SNARK_SCALAR_FIELD
                publicInputAccumulators[i+1] = addmod(publicInputAccumulators[i+1], mulmod(entropy[proofIndex], pisFlat[proofIndex * numPublicInputs + i], Utils.SNARK_SCALAR_FIELD), Utils.SNARK_SCALAR_FIELD);
            }
        }

        proofAandCs = new Pairing.G1Point[](numProofs + 1);
        proofAandCs[0].X = proofsFlat[0];
        proofAandCs[0].Y = proofsFlat[1];

        // raise As from each proof to entropy[i]
        for (uint256 proofIndex = 1; proofIndex < numProofs; proofIndex++) {
            Pairing.G1Point memory p = Pairing.G1Point(proofsFlat[proofIndex*8], proofsFlat[proofIndex*8+1]);
            uint256 s = entropy[proofIndex];

            proofAandCs[proofIndex] = Pairing.scalar_mul(p, s);
        }

        // MSM(proofC, entropy) for each proof
        Pairing.G1Point memory msmProduct = Pairing.G1Point(proofsFlat[6], proofsFlat[7]);
        for (uint256 proofIndex = 1; proofIndex < numProofs; proofIndex++) {
            Pairing.G1Point memory p = Pairing.G1Point(proofsFlat[proofIndex*8+6], proofsFlat[proofIndex*8+7]);
            uint256 s = entropy[proofIndex];
            Pairing.G1Point memory term = Pairing.scalar_mul(p, s);
            msmProduct = Pairing.addition(msmProduct, term); 
        }
        
        proofAandCs[numProofs] = msmProduct;

        return (proofAandCs, publicInputAccumulators);
    }

    function prepareBatch(
        uint256[14] memory vkFlat,
        Pairing.G1Point[] memory vkIC,
        uint256[] memory publicInputAccumulators
    ) internal view returns (
        Pairing.G1Point[2] memory finalVkAlphaXs
    ) {
        // Compute the linear combination vk_x using accumulator
        // First two fields are used as the sum and are initially zero

        // Performs an MSM(vkIC, publicInputAccumulators)
        Pairing.G1Point memory msmProduct = Pairing.scalar_mul(vkIC[0], publicInputAccumulators[1]); 
        for (uint256 i = 1; i < publicInputAccumulators.length; i++) {
            Pairing.G1Point memory product = Pairing.scalar_mul(vkIC[i], publicInputAccumulators[i]);
            msmProduct = Pairing.addition(msmProduct, product);
        }

        finalVkAlphaXs[0] = msmProduct;

        // add one extra memory slot for scalar for multiplication usage
        Pairing.G1Point memory finalVKalpha = Pairing.G1Point(vkFlat[0], vkFlat[1]);
        finalVKalpha = Pairing.scalar_mul(finalVKalpha, publicInputAccumulators[0]);
        finalVkAlphaXs[1] = finalVKalpha;

        return finalVkAlphaXs;
    }

    function BatchVerify ( 
        uint256[14] memory vkFlat,
        Pairing.G1Point[] memory vkIC,
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) internal view returns (bool success) {
        require(proofsFlat.length == numProofs * 8, "Invalid proofs length for a batch");
        require(pisFlat.length % numProofs == 0, "Invalid inputs length for a batch");
        require(vkIC.length - 1 == pisFlat.length / numProofs);

        // strategy is to accumulate entropy separately for some proof elements
        // (accumulate only for G1, can't in G2) of the pairing equation, as well as input verification key,
        // postpone scalar multiplication as much as possible and check only one equation 
        // by using 3 + numProofs pairings only plus 2*numProofs + (num_inputs+1) + 1 scalar multiplications compared to naive
        // 4*numProofs pairings and numProofs*(num_inputs+1) scalar multiplications
        
        (Pairing.G1Point[] memory proofAandCs, uint256[] memory publicInputAccumulators) = accumulate(proofsFlat, pisFlat, numProofs);
        Pairing.G1Point[2] memory finalVkAlphaXs = prepareBatch(vkFlat, vkIC, publicInputAccumulators);

        uint256[] memory inputs = new uint256[](6*numProofs + 18);
        // first numProofs pairings e(ProofA, ProofB)
        for (uint256 proofNumber = 0; proofNumber < numProofs; proofNumber++) {
            inputs[proofNumber*6] = proofAandCs[proofNumber*2].X;
            inputs[proofNumber*6 + 1] = proofAandCs[proofNumber*2].Y;
            inputs[proofNumber*6 + 2] = proofsFlat[proofNumber*8 + 2];
            inputs[proofNumber*6 + 3] = proofsFlat[proofNumber*8 + 3];
            inputs[proofNumber*6 + 4] = proofsFlat[proofNumber*8 + 4];
            inputs[proofNumber*6 + 5] = proofsFlat[proofNumber*8 + 5];
        }

        // second pairing e(-finalVKaplha, vk.beta)
        finalVkAlphaXs[0] = Pairing.negate(finalVkAlphaXs[0]);
        inputs[numProofs*6] = finalVkAlphaXs[0].X;
        inputs[numProofs*6 + 1] = finalVkAlphaXs[0].Y;
        inputs[numProofs*6 + 2] = vkFlat[2];
        inputs[numProofs*6 + 3] = vkFlat[3];
        inputs[numProofs*6 + 4] = vkFlat[4];
        inputs[numProofs*6 + 5] = vkFlat[5];

        // third pairing e(-finalVKx, vk.gamma)
        finalVkAlphaXs[1] = Pairing.negate(finalVkAlphaXs[1]);
        inputs[numProofs*6 + 6] = finalVkAlphaXs[1].X;
        inputs[numProofs*6 + 7] = finalVkAlphaXs[1].Y;
        inputs[numProofs*6 + 8] = vkFlat[6];
        inputs[numProofs*6 + 9] = vkFlat[7];
        inputs[numProofs*6 + 10] = vkFlat[8];
        inputs[numProofs*6 + 11] = vkFlat[9];

        // fourth pairing e(-proof.C, finalVKdelta)
        // third pairing e(-finalVKx, vk.gamma)
        proofAandCs[numProofs] = Pairing.negate(proofAandCs[numProofs]);
        inputs[numProofs*6 + 12] = proofAandCs[numProofs*2].X;
        inputs[numProofs*6 + 13] = proofAandCs[numProofs*2].Y;
        inputs[numProofs*6 + 14] = vkFlat[10];
        inputs[numProofs*6 + 15] = vkFlat[11];
        inputs[numProofs*6 + 16] = vkFlat[12];
        inputs[numProofs*6 + 17] = vkFlat[13];

        uint256 inputsLength = inputs.length * 32;
        uint[1] memory out;
        require(inputsLength % 192 == 0, "Inputs length should be multiple of 192 bytes");

        assembly {
            success := staticcall(sub(gas(), 2000), 8, add(inputs, 0x20), inputsLength, out, 0x20)
        }
        require(success, "Failed to call pairings functions");
        return out[0] == 1;
    }
}