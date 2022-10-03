pragma circom 2.0.0;

include "include/escalarmulany.circom";
include "include/poseidon.circom";

template Verify() {
    signal input pk0x;
    signal input pk0y;
    signal input pk1x;
    signal input pk1y;
    signal input m;
    signal input c;
    signal input z;

    component pk0z = EscalarMulAny(254);
    component pk1c = EscalarMulAny(254);
    component zBits = Num2Bits(254);
    component cBits = Num2Bits(254);

    pk0z.p[0] <== pk0x;
    pk0z.p[1] <== pk0y;
    zBits.in <== z;
    for (var i = 0; i < 254; i++) {
        pk0z.e[i] <== zBits.out[i];
    }

    pk1c.p[0] <== pk1x;
    pk1c.p[1] <== pk1y;
    cBits.in <== c;
    for (var i = 0; i < 254; i++) {
        pk1c.e[i] <== cBits.out[i];
    }

    component R = BabyAdd();
    R.x1 <== pk0z.out[0];
    R.y1 <== pk0z.out[1];
    R.x2 <== pk1c.out[0];
    R.y2 <== pk1c.out[1];

    component hash = Poseidon(5);
    hash.inputs[0] <== pk0x; // TODO changed to compressed format
    hash.inputs[1] <== pk1x; // TODO changed to compressed format
    hash.inputs[2] <== R.xout;
    hash.inputs[3] <== R.yout;
    hash.inputs[4] <== m;

    hash.out === c;
}
