import { BN254ScalarField as F, FieldElement } from "./field";
import constants from "./poseidonBnScalarConsts.json";
import { assert } from "./utils";

// Parameters are generated by a reference script https://extgit.iaik.tugraz.at/krypto/hadeshash/-/blob/master/code/generate_parameters_grain.sage
// Used like so: sage generate_parameters_grain.sage 1 0 254 2 8 56 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001
const CONSTANTS_C = constants.C.map(row => row.map(BigInt));
const CONSTANTS_S = constants.S.map(row => row.map(BigInt));
const CONSTANTS_M = constants.M.map(rows => rows.map(row => row.map(BigInt)));
const CONSTANTS_P = constants.P.map(rows => rows.map(row => row.map(BigInt)));

// Using recommended parameters from whitepaper https://eprint.iacr.org/2019/458.pdf (table 2, table 8)
// Generated by https://extgit.iaik.tugraz.at/krypto/hadeshash/-/blob/master/code/calc_round_numbers.py
// And rounded up to nearest integer that divides by t
const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

const pow5 = (a: FieldElement) => F.mul(a, F.square(F.square(a)));

function poseidon(inputs: FieldElement[]) {
    assert(inputs.length > 0);
    assert(inputs.length <= N_ROUNDS_P.length);

    const t = inputs.length + 1;
    const nRoundsF = N_ROUNDS_F;
    const nRoundsP = N_ROUNDS_P[t - 2];
    const C = CONSTANTS_C[t-2];
    const S = CONSTANTS_S[t-2];
    const M = CONSTANTS_M[t-2];
    const P = CONSTANTS_P[t-2];
    const zero = F.zero();

    let state = [zero, ...inputs];

    state = state.map((a, i) => F.add(a, C[i]));

    for (let r = 0; r < nRoundsF/2-1; r++) {
        state = state.map(a => pow5(a));
        state = state.map((a, i) => F.add(a, C[(r +1)* t +i]));
        state = state.map((_, i) =>
            state.reduce((acc, a, j) => F.add(acc, F.mul(M[j][i], a)), zero)
        );
    }
    state = state.map(a => pow5(a));
    state = state.map((a, i) => F.add(a, C[(nRoundsF/2-1 +1)* t +i]));
    state = state.map((_, i) =>
        state.reduce((acc, a, j) => F.add(acc, F.mul(P[j][i], a)), F.zero())
    );
    for (let r = 0; r < nRoundsP; r++) {
        state[0] = pow5(state[0]);
        state[0] = F.add(state[0], C[(nRoundsF/2 +1)*t + r]);


        const s0 = state.reduce((acc, a, j) => {
            return F.add(acc, F.mul(S[(t*2-1)*r+j], a));
        }, zero);
        for (let k=1; k<t; k++) {
            state[k] = F.add(state[k], F.mul(state[0], S[(t*2-1)*r+t+k-1]   ));
        }
        state[0] =s0;
    }
    for (let r = 0; r < nRoundsF/2-1; r++) {
        state = state.map(a => pow5(a));
        state = state.map((a, i) => F.add(a, C[ (nRoundsF/2 +1)*t + nRoundsP + r*t + i ]));
        state = state.map((_, i) =>
            state.reduce((acc, a, j) => F.add(acc, F.mul(M[j][i], a)), zero)
        );
    }
    state = state.map(a => pow5(a));
    state = state.map((_, i) =>
        state.reduce((acc, a, j) => F.add(acc, F.mul(M[j][i], a)), zero)
    );

    return F.reduce(state[0]);
}