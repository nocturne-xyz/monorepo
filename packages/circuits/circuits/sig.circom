pragma circom 2.0.0;

include "include/escalarmulany.circom";
include "include/escalarmulfix.circom";
include "include/poseidon.circom";

// Schnorr signature using Poseidon hash
// Challenge version, no key-prefixing
template Verify() {
    signal input pkx;
    signal input pky;
    signal input m;
    signal input c;
    signal input z;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    component gz = EscalarMulFix(253, BASE8);
    component pkc = EscalarMulAny(254);
    component zBits = Num2Bits(254);
    component cBits = Num2Bits(254);

    zBits.in <== z;
    for (var i = 0; i < 253; i++) {
        gz.e[i] <== zBits.out[i];
    }

    pkc.p[0] <== pkx;
    pkc.p[1] <== pky;
    cBits.in <== c;
    for (var i = 0; i < 254; i++) {
        pkc.e[i] <== cBits.out[i];
    }

    component R = BabyAdd();
    R.x1 <== gz.out[0];
    R.y1 <== gz.out[1];
    R.x2 <== pkc.out[0];
    R.y2 <== pkc.out[1];

    component hash = Poseidon(3);
    hash.inputs[0] <== R.xout; // TODO changed to compressed format
    hash.inputs[1] <== R.yout; // TODO changed to compressed format
    hash.inputs[2] <== m;

    hash.out === c;
}
