import { poseidonBN, randomFp } from "@nocturne-xyz/crypto";
import { range } from "../src";

function printTestCase(n: number, initialState: bigint): void {
  const elems = range(n).map(() => randomFp());
  const out = poseidonBN(elems, initialState);

  console.log(`PoseidonExtT${n + 1}`);
  console.log("initialState:", initialState);
  console.log("elems:", elems);
  console.log("out:", out);
  console.log();
}

printTestCase(2, 12345n);
printTestCase(3, 12345n);
printTestCase(6, 12345n);
