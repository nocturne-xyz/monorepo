pragma circom 2.1.0;

include "lib.circom";
include "include/babyjub.circom";

//@ensures(1) `compressedCanonAddr` and the sign bit from `nonceAndSignBit` are a valid canonical address
//@ensures(2) the prover can produce a valid signature of the message
//  `CANONICAL_ADDRESS_REGISTRY_DOMAIN_PREFIX | nonce` using the
//   spending key corresponding the canonical address given in public inputs
template CanonAddrSigCheck() {
    // *** PUBLIC INPUTS ***
	signal input compressedCanonAddrY;
	signal input nonceAndSignBit;

	// *** WITNESS ***
	// signature on fixed message used to prove knowledge of viewing key
	signal input sig[2];
	signal input spendPubkey[2];
	signal input vkNonce;

	signal nonceAndSignBitBits[65] <== Num2Bits(65)(nonceAndSignBit);
	signal signBit <== nonceAndSignBitBits[64];
	signal nonce <== nonceAndSignBit - (1 << 64) * signBit;

    BabyCheck()(spendPubkey[0], spendPubkey[1]);
    IsOrderL()(spendPubkey[0], spendPubkey[1]);

	// keccak256("nocturne-canonical-address-registry") % l (baby jubjub scalar field order)
	var CANONICAL_ADDRESS_REGISTRY_DOMAIN_PREFIX = 116601516046334945492116181810016234440204750152070409904129749171886331002;
	signal msg <== Poseidon(2)([CANONICAL_ADDRESS_REGISTRY_DOMAIN_PREFIX, nonce]);

	//@lemma(1) prover can generate valid sig for `CANONICAL_ADDRESS_REGISTRY_DOMAIN_PREFIX | nonce` against spendPubkey
	//@argument `SigVerify.requires(1)` is guaranteed by checks above. lemma follows from `SigVerify.ensures(1)` 
	SigVerify()(spendPubkey, msg, sig);

	//@satisfies(2)
	//@argument `VKDerivation.requires(1)` is guranteed by checks above.
	// `VKDerivation.ensures(3, 1)` => vkBits is the LE repr of the correct VK derived from spendPubkey and vkNonce
	// => `CanonAddr.requires(1)` is satisfied. Then, (2) follows from `CanonAddr.ensures(2)` and `@lemma(1)`
	component vkDerivation = VKDerivation();	
	vkDerivation.spendPubkey <== spendPubkey;
	vkDerivation.vkNonce <== vkNonce;
	signal vkBits[251] <== vkDerivation.vkBits;
	signal canonAddr[2] <== CanonAddr()(vkBits);

	//@satisfies(1)
	//@argument `CanonAddr` above ensures that canonAddr is a valid canonical address.
	// the checks below ensure that it matches the one given in PIs. Therefore (1) is satisfied.
	component compressor = CompressPoint();
	compressor.in <== canonAddr;
	compressedCanonAddrY === compressor.y;
	signBit === compressor.sign;
}

component main { public [compressedCanonAddrY, nonceAndSignBit] } = CanonAddrSigCheck();
