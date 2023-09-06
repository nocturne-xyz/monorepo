import { _TypedDataEncoder } from "ethers/lib/utils";
import { CanonAddrRegistryEntry } from "../src";
import {
  CANON_ADDR_REGISTRY_ENTRY_TYPES,
  computeCanonAddrRegistryEntryDigest,
  hashCanonAddrRegistryEntry,
} from "../src/primitives/canonAddrRegistryEntry";

(async () => {
  const entry: CanonAddrRegistryEntry = {
    ethAddress: "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
    perCanonAddrNonce: 123n,
  };

  const entryHash = hashCanonAddrRegistryEntry(entry);
  console.log("entryHash", entryHash);

  const digest = computeCanonAddrRegistryEntryDigest(
    entry,
    1n,
    "0x1111111111111111111111111111111111111111"
  );
  console.log("entry digest", digest);

  const typehash = new _TypedDataEncoder(CANON_ADDR_REGISTRY_ENTRY_TYPES)
    ._types["CanonAddrRegistryEntry"];
  console.log("typehash", typehash);
})();
