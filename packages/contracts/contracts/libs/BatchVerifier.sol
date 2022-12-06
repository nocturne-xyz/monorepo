//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
import {Pairing} from "./Pairing.sol";
import {Utils} from "./Utils.sol";

library BatchVerifier {
    struct VerifyingKey {
        Pairing.G1Point alpha1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }

    function accumulate(
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    )
        internal
        view
        returns (
            Pairing.G1Point[] memory proofAsandAggegateC,
            uint256[] memory publicInputAccumulators
        )
    {
        uint256 numPublicInputs = pisFlat.length / numProofs;
        uint256[] memory entropy = new uint256[](numProofs);
        publicInputAccumulators = new uint256[](numPublicInputs + 1);

        // Generate entropy for each proof and accumulate each PI
        // seed a challenger by hashing all of the proofs and the current blockhash togethre
        uint256 challengerState = uint256(
            keccak256(abi.encodePacked(proofsFlat, blockhash(block.number - 1)))
        );
        for (uint256 proofIndex = 0; proofIndex < numProofs; proofIndex++) {
            if (proofIndex == 0) {
                entropy[proofIndex] = 1;
            } else {
                challengerState = uint256(
                    keccak256(abi.encodePacked(challengerState))
                );
                entropy[proofIndex] = challengerState;
            }
            require(entropy[proofIndex] != 0, "Entropy should not be zero");
            // here multiplication by 1 is implied
            publicInputAccumulators[0] = addmod(
                publicInputAccumulators[0],
                entropy[proofIndex],
                Utils.SNARK_SCALAR_FIELD
            );
            for (uint256 i = 0; i < numPublicInputs; i++) {
                // accumulate the exponent with extra entropy mod Utils.SNARK_SCALAR_FIELD
                publicInputAccumulators[i + 1] = addmod(
                    publicInputAccumulators[i + 1],
                    mulmod(
                        entropy[proofIndex],
                        pisFlat[proofIndex * numPublicInputs + i],
                        Utils.SNARK_SCALAR_FIELD
                    ),
                    Utils.SNARK_SCALAR_FIELD
                );
            }
        }

        proofAsandAggegateC = new Pairing.G1Point[](numProofs + 1);
        proofAsandAggegateC[0].X = proofsFlat[0];
        proofAsandAggegateC[0].Y = proofsFlat[1];

        // raise As from each proof to entropy[i]
        for (uint256 proofIndex = 1; proofIndex < numProofs; proofIndex++) {
            Pairing.G1Point memory p = Pairing.G1Point(
                proofsFlat[proofIndex * 8],
                proofsFlat[proofIndex * 8 + 1]
            );
            uint256 s = entropy[proofIndex];

            proofAsandAggegateC[proofIndex] = Pairing.scalar_mul(p, s);
        }

        // MSM(proofC, entropy) for each proof
        Pairing.G1Point memory msmProduct = Pairing.G1Point(
            proofsFlat[6],
            proofsFlat[7]
        );
        for (uint256 proofIndex = 1; proofIndex < numProofs; proofIndex++) {
            Pairing.G1Point memory p = Pairing.G1Point(
                proofsFlat[proofIndex * 8 + 6],
                proofsFlat[proofIndex * 8 + 7]
            );
            uint256 s = entropy[proofIndex];
            Pairing.G1Point memory term = Pairing.scalar_mul(p, s);
            msmProduct = Pairing.addition(msmProduct, term);
        }

        proofAsandAggegateC[numProofs] = msmProduct;

        return (proofAsandAggegateC, publicInputAccumulators);
    }

    function prepareBatch(
        VerifyingKey memory vk,
        uint256[] memory publicInputAccumulators
    ) internal view returns (Pairing.G1Point[2] memory finalVKAlphaAndX) {
        // Compute the linear combination vk_x using accumulator
        // First two fields are used as the sum and are initially zero

        // Performs an MSM(vkIC, publicInputAccumulators)
        Pairing.G1Point memory msmProduct = Pairing.scalar_mul(
            vk.IC[0],
            publicInputAccumulators[0]
        );
        for (uint256 i = 1; i < publicInputAccumulators.length; i++) {
            Pairing.G1Point memory product = Pairing.scalar_mul(
                vk.IC[i],
                publicInputAccumulators[i]
            );
            msmProduct = Pairing.addition(msmProduct, product);
        }

        finalVKAlphaAndX[1] = msmProduct;

        // add one extra memory slot for scalar for multiplication usage
        Pairing.G1Point memory finalVKalpha = vk.alpha1;
        finalVKalpha = Pairing.scalar_mul(
            finalVKalpha,
            publicInputAccumulators[0]
        );
        finalVKAlphaAndX[0] = finalVKalpha;

        return finalVKAlphaAndX;
    }

    function batchVerifyProofs(
        VerifyingKey memory vk,
        uint256[] memory proofsFlat,
        uint256[] memory pisFlat,
        uint256 numProofs
    ) internal view returns (bool success) {
        require(
            proofsFlat.length == numProofs * 8,
            "Invalid proofs length for a batch"
        );
        require(
            pisFlat.length % numProofs == 0,
            "Invalid inputs length for a batch"
        );
        require(vk.IC.length == (pisFlat.length / numProofs) + 1);

        // strategy is to accumulate entropy separately for some proof elements
        // (accumulate only for G1, can't in G2) of the pairing equation, as well as input verification key,
        // postpone scalar multiplication as much as possible and check only one equation
        // by using 3 + numProofs pairings only plus 2*numProofs + (num_inputs+1) + 1 scalar multiplications compared to naive
        // 4*numProofs pairings and numProofs*(num_inputs+1) scalar multiplications

        (
            Pairing.G1Point[] memory proofAsandAggegateC,
            uint256[] memory publicInputAccumulators
        ) = accumulate(proofsFlat, pisFlat, numProofs);
        Pairing.G1Point[2] memory finalVKAlphaAndX = prepareBatch(
            vk,
            publicInputAccumulators
        );

        Pairing.G1Point[] memory p1s = new Pairing.G1Point[](numProofs + 3);
        Pairing.G2Point[] memory p2s = new Pairing.G2Point[](numProofs + 3);

        // first numProofs pairings e(ProofA, ProofB)
        for (uint256 proofNumber = 0; proofNumber < numProofs; proofNumber++) {
            p1s[proofNumber] = proofAsandAggegateC[proofNumber];
            p2s[proofNumber] = Pairing.G2Point(
                [
                    proofsFlat[proofNumber * 8 + 2],
                    proofsFlat[proofNumber * 8 + 3]
                ],
                [
                    proofsFlat[proofNumber * 8 + 4],
                    proofsFlat[proofNumber * 8 + 5]
                ]
            );
        }

        // second pairing e(-finalVKaplha, vk.beta)
        p1s[numProofs] = Pairing.negate(finalVKAlphaAndX[0]);
        p2s[numProofs] = vk.beta2;

        // third pairing e(-finalVKx, vk.gamma)
        p1s[numProofs + 1] = Pairing.negate(finalVKAlphaAndX[1]);
        p2s[numProofs + 1] = vk.gamma2;

        // fourth pairing e(-proof.C, vk.delta)
        p1s[numProofs + 2] = Pairing.negate(proofAsandAggegateC[numProofs]);
        p2s[numProofs + 2] = vk.delta2;

        return Pairing.pairing(p1s, p2s);
    }
}
