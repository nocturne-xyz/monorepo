pragma circom 2.0.0;

include "include/babyjub.circom";
include "include/poseidon.circom";
include "include/escalarmulany.circom";

include "tree.circom";
include "note.circom";

template Spend(levels) {
    // viewing / nullifier key
    signal input vk;
    // validating key randomizer
    signal input r[254];

    // Old note
    signal input oldNoteOwnerH1X;
    signal input oldNoteOwnerH1Y;
    signal input oldNoteOwnerH2X;
    signal input oldNoteOwnerH2Y;
    signal input oldNoteNonce;
    signal input oldNoteType;
    signal input oldNoteValue;

    // Path to old note
    signal input path[levels];
    signal input siblings[levels];

    // New note
    signal input newNoteOwnerH1X;
    signal input newNoteOwnerH1Y;
    signal input newNoteOwnerH2X;
    signal input newNoteOwnerH2Y;
    signal input newNoteNonce;
    signal input newNoteType;
    signal input newNoteValue;

    // Public outputs
    signal output newNoteCommitment;
    signal output anchor;
    signal output type;
    signal output value;
    signal output nullifier;
    signal output validatingKeyX;
    signal output validatingKeyY;

    // Computing oldNoteCommitment
    signal oldNoteCommitment;
    component oldNoteCommit = NoteCommit();
    oldNoteCommit.ownerH1X <== oldNoteOwnerH1X;
    oldNoteCommit.ownerH1Y <== oldNoteOwnerH1Y;
    oldNoteCommit.ownerH2X <== oldNoteOwnerH2X;
    oldNoteCommit.ownerH2Y <== oldNoteOwnerH2Y;
    oldNoteCommit.nonce <== oldNoteNonce;
    oldNoteCommit.type <== oldNoteType;
    oldNoteCommit.value <== oldNoteValue;
    oldNoteCommitment <== oldNoteCommit.out;

    // Merkle tree inclusion proof for oldNoteCommitment
    component inclusionProof = MerkleTreeInclusionProof(levels);
    inclusionProof.leaf <== oldNoteCommitment;
    for (var i = 0; i < levels; i++) {
        inclusionProof.siblings[i] <== siblings[i];
        inclusionProof.pathIndices[i] <== path[i];
    }

    anchor <== inclusionProof.root;

    // Nullifier derivation for oldNote
    component deriveNullifier = DeriveNullifier();
    deriveNullifier.noteCommitment <== oldNoteCommitment;
    deriveNullifier.vk <== vk;
    nullifier <== deriveNullifier.nullifier;

    // type and value
    type <== oldNoteType; oldNoteType === newNoteType;
    value <== oldNoteValue - newNoteValue;

    // Spending key integrity
    component vkBits = Num2Bits(254);
    vkBits.in <== vk;

    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    component mulFix = EscalarMulFix(254, BASE8);
    for (var i=0; i < 254; i++) {
        mulFix.e[i] <== vkBits.out[i];
    }
    mulFix.out[0] === oldNoteOwnerH1X;
    mulFix.out[1] === oldNoteOwnerH1Y;

    // Validating key
    component mulAny = EscalarMulAny(254);
    for (var i = 0; i < 254; i++) {
        mulAny.e[i] <== r[i];
    }
    mulAny.p[0] <== oldNoteOwnerH2X;
    mulAny.p[1] <== oldNoteOwnerH2Y;
    validatingKeyX <== mulAny.out[0];
    validatingKeyY <== mulAny.out[1];

    // Computing newNoteCommitment
    component newNoteCommit = NoteCommit();
    newNoteCommit.ownerH1X <== newNoteOwnerH1X;
    newNoteCommit.ownerH1Y <== newNoteOwnerH1Y;
    newNoteCommit.ownerH2X <== newNoteOwnerH2X;
    newNoteCommit.ownerH2Y <== newNoteOwnerH2Y;
    newNoteCommit.nonce <== newNoteNonce;
    newNoteCommit.type <== newNoteType;
    newNoteCommit.value <== newNoteValue;
    newNoteCommitment <== newNoteCommit.out;
}

component main = Spend(32);
