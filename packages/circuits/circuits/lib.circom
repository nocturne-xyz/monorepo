pragma circom 2.1.0;

include "include/poseidon.circom";
include "include/escalarmulany.circom";
include "include/aliascheck.circom";
include "include/compconstant.circom";
include "include/bitify.circom";
include "include/comparators.circom";

// Note structure
// owner, nonce, encodedAsset, encodedAssetId, value

template NoteCommit() {
    signal input ownerHash;
    signal input nonce;
    signal input encodedAssetAddr;
    signal input encodedAssetId;
    signal input value;

    signal output out;

    component noteHash = Poseidon(5);
    noteHash.inputs[0] <== ownerHash;
    noteHash.inputs[1] <== nonce;
    noteHash.inputs[2] <== encodedAssetAddr;
    noteHash.inputs[3] <== encodedAssetId;
    noteHash.inputs[4] <== value;

    out <== noteHash.out;
}

template DeriveNullifier() {
    signal input vk;
    signal input noteCommitment;

    signal output nullifier;

    component hash = Poseidon(2);
    hash.inputs[0] <== vk;
    hash.inputs[1] <== noteCommitment;
    nullifier <== hash.out;
}

//@requires(1) `PX` and `PY` comprise a valid Baby Jubjub point (i.e. it's on-curve)
//@ensures(1) `PX` and `PY` comprise a high-order Baby Jubjub point
template IsOrderGreaterThan8() {
    signal input PX;
    signal input PY;

    signal P2X, P2Y, P4X, P4Y, P8X, P8Y;

    (P2X, P2Y) <== BabyDbl()(PX, PY);
    (P4X, P4Y) <== BabyDbl()(P2X, P2Y);
    (P8X, P8Y) <== BabyDbl()(P4X, P4Y);

    // check that 8P's X coordinate is not zero
    signal p8XIsZero <== IsZero()(P8X);
    p8XIsZero === 0;
}

//@requires(1) `spendPubkey` is a valid, high-order Baby Jubjub point
//@ensures(1) `vkBits` is a 251-bit little-endian representation of `vk`, which entails that every signal in the array is binary
//@ensures(2) `vk` is an element of the scalar field of Baby Jubjub's prime-order subgroup
//@ensures(3) `vk` is correctly derived from `spendPubkey` and `vkNonce`
template VKDerivation() {
    signal input spendPubkey[2];
    signal input vkNonce;
    signal output vk;
    signal output vkBits[251];

    // derive spending public key and check it matches the one given
    //@satisfies(3)
    //@argument correct by definition of Nocturne's key derivation process, provided that `vkNonce` is correct
    vk <== Poseidon(3)([spendPubkey[0], spendPubkey[1], vkNonce]);

    //@satisfies(1)
    //@argument this is precisely what `Num2Bits(251)` does. If `vk` is greater than 251-bits, then `Num2Bits(251)` would be unsatisfiable
    vkBits <== Num2Bits(251)(vk);

    //@satsfies(2)
    //@argument we know from the previous check that `vk` is a 251-bit number. To ensure it's a member of the scalar field,
    // we do a 251-bit comparison with the order of the scalar field, which is sufficient to ensure that it's an element of the scalar field
    component gtFrOrderMinusOne = CompConstant(BABYJUB_SCALAR_FIELD_ORDER - 1);
    for (var i=0; i<251; i++) {
      gtFrOrderMinusOne.in[i] <== vkBits[i];
    }
    gtFrOrderMinusOne.in[251] <== 0;
    gtFrOrderMinusOne.in[252] <== 0;
    gtFrOrderMinusOne.in[253] <== 0;
    0 === gtFrOrderMinusOne.out;

}

// checks that a stealth address belongs to a given vk
//@requires(1) `H1X` and `H1Y` comprise a valid, high-order Baby Jubjub point (i.e. it's on-curve)
//@requires(2) `H2X` and `H2Y` comprise a valid, but not necessarily high-order Baby Jubjub point (i.e. it's on-curve)
//@ensures(1) `H2X` and `H2Y` comprise a high-order Baby Jubjub point (i.e. it's on-curve)
//@ensures(2) `H1X`, `H1Y`, `H2X`, and `H2Y` comprise a stealth address "owned" by the viewing key represented by `vkBits` according to the stealth address scheme
template StealthAddrOwnership() {
    // X and Y coordinates of both
    // components of the stealth address
    signal input H1X;
    signal input H1Y;
    signal input H2X;
    signal input H2Y;

    // little-endian bit representation of viewing key
    // we check elsewhere that this viewing key was derived correctly
    // here we assume it was, in which case it fits in 251 bits
    // and we can avoid a Num2Bits_strict
    signal input vkBits[251];

    // G = vk * H1
    signal GX, GY, GGX, GGY, GG2X, GG2Y, GG4X, GG4Y, GG8X, GG8Y;
    signal G[2];
    G <== EscalarMulAny(251)(vkBits, [H1X, H1Y]);
    // GG = vk * H1 - H2
    (GGX, GGY) <== BabyAdd()(G[0], G[1], -H2X, H2Y);
    (GG2X, GG2Y) <== BabyDbl()(GGX, GGY);
    (GG4X, GG4Y) <== BabyDbl()(GG2X, GG2Y);
    (GG8X, GG8Y) <== BabyDbl()(GG4X, GG4Y);

    GG8X === 0;
    GG8Y === 1;
}

template SigVerify() {
    signal input pk[2];
    signal input m;
    signal input sig[2]; // [c, z]

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    component gz = EscalarMulFix(251, BASE8);
    component pkc = EscalarMulAny(254);

    // OPTIMIZATION:
    // let r be the order of Baby Jubjub's scalar field
    // if z > r, then wraparound will happen in the scalar mul
    // therefore, it's equivalent to simply require the prover to reduce it.
    // before plugging it into the circuit
    // The case where the reduced version isn't correct is equivalent to the case
    // where `z` is bogus - the signature check will still fail.
    // therefore we can simply assume it's 251 bits and not explicitly compare to r
    component zBits = Num2Bits(251);

    // we do, however, need to check this against an un-reduced poseidon hash computed in joinsplit.circom
    // therefore we sitll use Num2Bits_strict here
    component cBits = Num2Bits_strict();

    zBits.in <== sig[1];
    for (var i = 0; i < 251; i++) {
        gz.e[i] <== zBits.out[i];
    }

    pkc.p <== pk;
    cBits.in <== sig[0];
    for (var i = 0; i < 254; i++) {
        pkc.e[i] <== cBits.out[i];
    }

    component R = BabyAdd();
    R.x1 <== gz.out[0];
    R.y1 <== gz.out[1];
    R.x2 <== pkc.out[0];
    R.y2 <== pkc.out[1];

    signal cp <== Poseidon(4)([pk[0], R.xout, R.yout, m]);
    cp === sig[0];
}

//@requires(1) `vkBits` is a 251-bit little-endian representation of `vk`, which entails that every signal in the array is binary
//@ensures(1) `addr` is a valid, high-order Baby Jubjub point
//@ensures(2) `addr` is the correct canonical address corresponding to `vk`
template CanonAddr() {
    // little-endian bit representation of viewing key
    // we check elsewhere that this viewing key was derived correctly
    // here we assume it was, in which case it fits in 251 bits
    // and we can avoid a Num2Bits_strict
    signal input userViewKeyBits[251];
    // the canonical address corresponding to given viewing key
    signal output addr[2];

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    addr <== EscalarMulFix(251, BASE8)(userViewKeyBits);
}

// Forces the input signal to be of value between 0 and 2**n - 1
//@requires `n < 254`
//@ensures `out` can be represented as an `n`-bit number, or equivalently that `out < 2^n`
template RangeCheckNBits(n) {
    signal input in;

    // Num2Bits does all the work here. All we care is that they're all bits
    signal bits[n] <== Num2Bits(n)(in);
}

// Encrypt each input value, using poseidon as as a blockcipher in counter
// mode, with rand as initial value (IV)
template Encrypt(n) {
    signal input rand;
    signal input in[n];

    signal output out[n];

    for (var i = 0; i < n; i++) {
      var pad = Poseidon(1)([rand + i]);
      out[i] <== pad + in[i];
    }
}

// takes `2n` bits and outputs n 2-bit limbs
// interpreted in little-endian order
template BitsToTwoBitLimbs(n) {
    signal input bits[2*n];
    signal output limbs[n];

    for (var i = 0; i < n; i++) {
        limbs[i] <== bits[i*2] + 2*bits[i*2 + 1];
    }
}

// slices first k elements out of an array of n elements
// why doesn't circom support this????
template SliceFirstK(n, k) {
    signal input arr[n];
    signal output slice[k];

    for (var i = 0; i < k; i++) {
        slice[i] <== arr[i];
    }
}

template SliceLastK(n, k) {
    signal input arr[n];
    signal output slice[k];

    for (var i = n - k; i < n; i++) {
        slice[i - (n - k)] <== arr[i];
    }
}


// same as `Point2Bits_strict` (https://github.com/iden3/circomlib/blob/cff5ab6288b55ef23602221694a6a38a0239dcc0/circuits/pointbits.circom#L136),
// but returns the result as y cordinate and x coordinate's sign bit in two field elements instead of as a bit array
template CompressPoint() {
    signal input in[2];
    signal output y;
    signal output sign;

    y <== in[1];

    // bit-decompose x coordinate
    signal xBits[254] <== Num2Bits_strict()(in[0]);

    // get the "sign" bit by comparing x to (p-1)/2. If it's bigger, then we call it "negative"
    sign <== CompConstant(10944121435919637611123202872628637544274182200208017171849102093287904247808)(xBits);
}
