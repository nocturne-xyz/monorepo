pragma circom 2.1.0;

include "lib.circom";
include "include/babyjub.circom";

//@ensures(1) `canonAddrX`, `canonAddrY` comprise a canonical address that's a valid, order-l Baby Jubjub point
//@ensures(2) the prover knows the viewing key corresponding to the canonical address
template CanonAddrSigCheck() {
    // *** PUBLIC INPUTS ***
	signal input canonAddrX;
	signal input canonAddrY;

	// *** WITNESS ***
	// signature on fixed message used to prove knowledge of viewing key
	signal input sig[2];

	// keccak256("nocturne-canonical-address-registry") % p
	var CANONICAL_ADDRESS_REGISTRY_MSG = 8324692592986063153834518336281494392869088797185283377215340035052539916258;

	//@satisfies(1) because `BabyCheck` ensures the point is on-curve and `IsOrderL` ensures the point is of order l
    BabyCheck()(canonAddrX, canonAddrY);
    IsOrderL()(canonAddrX, canonAddrY);

	//@satisfies(2) since `SigVerify.requires(1)` is guaranteed by `@ensures(1)`, then `SigVerify.ensures(1)` is true
	// in which case the prover must know the viewing key - otherwise they would not be able to produce a valid signature
	SigVerify()([canonAddrX, canonAddrY], CANONICAL_ADDRESS_REGISTRY_MSG, sig);
}

component main { public [canonAddrX, canonAddrY] } = CanonAddrSigCheck();