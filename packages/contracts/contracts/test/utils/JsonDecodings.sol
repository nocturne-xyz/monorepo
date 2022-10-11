// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;
pragma abicoder v2;

struct Spend2ProofWithPublicSignals {
    BaseProof proof;
    uint256[9] publicSignals;
}

struct BaseProof {
    string curve;
    uint256[] pi_a;
    uint256[][] pi_b;
    uint256[] pi_c;
    string protocol;
}
