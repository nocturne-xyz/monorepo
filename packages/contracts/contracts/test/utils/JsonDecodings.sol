// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;
pragma abicoder v2;

struct Spend2ProofWithPublicSignals {
    string[9] publicSignals;
    BaseProof proof;
}

struct BaseProof {
    string curve;
    string[] pi_a;
    string[][] pi_b;
    string[] pi_c;
    string protocol;
}
