pragma circom 2.1.0;

include "lib.circom";
include "include/babyjub.circom";

//@ensures(1) `canonAddrX`, `canonAddrY` comprise a canonical address that's a valid, order-l Baby Jubjub point
//@ensures(2) the prover knows the spending key corresponding to the canonical address
template CanonAddrSigCheck() {
    // *** PUBLIC INPUTS ***
	signal input canonAddrX;
	signal input canonAddrY;

	// *** WITNESS ***
	// signature on fixed message used to prove knowledge of viewing key
	signal input sig[2];
	signal input spendPubkey[2];
	signal input vkNonce;

	//@satisfies(1)
	//@argument because `BabyCheck` ensures the point is on-curve and `IsOrderL` ensures the point is of order l
    BabyCheck()(canonAddrX, canonAddrY);
    IsOrderL()(canonAddrX, canonAddrY);

    BabyCheck()(spendPubkey[0], spendPubkey[1]);
    IsOrderL()(spendPubkey[0], spendPubkey[1]);

	// keccak256("nocturne-canonical-address-registry") % l (baby jubjub scalar field order)
	var CANONICAL_ADDRESS_REGISTRY_MSG = 116601516046334945492116181810016234440204750152070409904129749171886331002;

	//@lemma(1) prover knows the spending key corresponding to `spendPubkey`
	//@argument `SigVerify.requires(1)` is guaranteed by checks above. Therefore `SigVerify.ensures(1)` is true
	// in which case the prover must know the underlying spending key for spendPubkey (otherwise they can't produce valid sig)
	SigVerify()(spendPubkey, CANONICAL_ADDRESS_REGISTRY_MSG, sig);


	//@satisfies(2)
	//@argument `VKDerivation.requires(1)` is guranteed by checks above.
	// `VKDerivation.ensures(3, 1)` => vkBits is the LE repr of the correct VK derived from spendPubkey and vkNonce
	// => `CanonAddr.requires(1)` is satisfied. Then, (2) follows from `CanonAddr.ensures(2)` and `@lemma(1)`
	component vkDerivation = VKDerivation();	
	vkDerivation.spendPubkey <== spendPubkey;
	vkDerivation.vkNonce <== vkNonce;
	signal vkBits[251] <== vkDerivation.vkBits;
	signal derivedCanonAddr[2] <== CanonAddr()(vkBits);
	derivedCanonAddr[0] === canonAddrX;
	derivedCanonAddr[1] === canonAddrY;
}

component main { public [canonAddrX, canonAddrY] } = CanonAddrSigCheck();