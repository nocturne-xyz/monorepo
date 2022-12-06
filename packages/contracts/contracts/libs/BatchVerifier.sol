//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
import {Pairing} from "./Pairing.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {Utils} from "./Utils.sol";

library BatchVerifier {
    function accumulate(
        IVerifier.Proof[] memory proofs,
        uint256[] memory pisFlat
    )
        internal
        view
        returns (
            Pairing.G1Point[] memory proofAsandAggegateC,
            uint256[] memory publicInputAccumulators
        )
    {
        uint256 numPublicInputs = pisFlat.length / proofs.length;
        uint256[] memory entropy = new uint256[](proofs.length);
        publicInputAccumulators = new uint256[](numPublicInputs + 1);

        // Generate entropy for each proof and accumulate each PI
        // seed a challenger by hashing all of the proofs and the current blockhash togethre
        uint256 challengerState = uint256(
            keccak256(abi.encode(proofs, blockhash(block.number - 1)))
        );
        for (uint256 proofIndex = 0; proofIndex < proofs.length; proofIndex++) {
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

        proofAsandAggegateC = new Pairing.G1Point[](proofs.length + 1);
        proofAsandAggegateC[0] = proofs[0].A;

        // raise As from each proof to entropy[i]
        for (uint256 proofIndex = 1; proofIndex < proofs.length; proofIndex++) {
            uint256 s = entropy[proofIndex];
            proofAsandAggegateC[proofIndex] = Pairing.scalar_mul(
                proofs[proofIndex].A,
                s
            );
        }

        // MSM(proofCs, entropy)
        Pairing.G1Point memory msmProduct = proofs[0].C;
        for (uint256 proofIndex = 1; proofIndex < proofs.length; proofIndex++) {
            uint256 s = entropy[proofIndex];
            Pairing.G1Point memory term = Pairing.scalar_mul(
                proofs[proofIndex].C,
                s
            );
            msmProduct = Pairing.addition(msmProduct, term);
        }

        proofAsandAggegateC[proofs.length] = msmProduct;

        return (proofAsandAggegateC, publicInputAccumulators);
    }

    function prepareBatch(
        IVerifier.VerifyingKey memory vk,
        uint256[] memory publicInputAccumulators
    ) internal view returns (Pairing.G1Point[2] memory finalVKAlphaAndX) {
        // Compute the linear combination vk_x using accumulator

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
        IVerifier.VerifyingKey memory vk,
        IVerifier.Proof[] memory proofs,
        uint256[] memory pisFlat
    ) internal view returns (bool success) {
        require(
            pisFlat.length % proofs.length == 0,
            "Invalid inputs length for a batch"
        );
        require(vk.IC.length == (pisFlat.length / proofs.length) + 1);

        // strategy is to accumulate entropy separately for some proof elements
        // (accumulate only for G1, can't in G2) of the pairing equation, as well as input verification key,
        // postpone scalar multiplication as much as possible and check only one equation
        // by using 3 + proofs.length pairings only plus 2*proofs.length + (num_inputs+1) + 1 scalar multiplications compared to naive
        // 4*proofs.length pairings and proofs.length*(num_inputs+1) scalar multiplications

        (
            Pairing.G1Point[] memory proofAsandAggegateC,
            uint256[] memory publicInputAccumulators
        ) = accumulate(proofs, pisFlat);
        Pairing.G1Point[2] memory finalVKAlphaAndX = prepareBatch(
            vk,
            publicInputAccumulators
        );

        Pairing.G1Point[] memory p1s = new Pairing.G1Point[](proofs.length + 3);
        Pairing.G2Point[] memory p2s = new Pairing.G2Point[](proofs.length + 3);

        // first proofs.length pairings e(ProofA, ProofB)
        for (
            uint256 proofNumber = 0;
            proofNumber < proofs.length;
            proofNumber++
        ) {
            p1s[proofNumber] = proofAsandAggegateC[proofNumber];
            p2s[proofNumber] = proofs[proofNumber].B;
        }

        // second pairing e(-finalVKaplha, vk.beta)
        p1s[proofs.length] = Pairing.negate(finalVKAlphaAndX[0]);
        p2s[proofs.length] = vk.beta2;

        // third pairing e(-finalVKx, vk.gamma)
        p1s[proofs.length + 1] = Pairing.negate(finalVKAlphaAndX[1]);
        p2s[proofs.length + 1] = vk.gamma2;

        // fourth pairing e(-proof.C, vk.delta)
        p1s[proofs.length + 2] = Pairing.negate(
            proofAsandAggegateC[proofs.length]
        );
        p2s[proofs.length + 2] = vk.delta2;

        return Pairing.pairing(p1s, p2s);
    }
}
