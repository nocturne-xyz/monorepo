import {
  poseidon2,
  poseidon3,
  poseidon6,
  randomFp
} from "@nocturne-xyz/crypto";
import { range } from "../src";

function poseidonN(n: number): (elems: bigint[], initialState?: bigint) => bigint {
  switch (n) {
    case 2:
      return poseidon2 as (elems: bigint[], initialState?: bigint) => bigint;
    case 3:
      return poseidon3 as (elems: bigint[], initialState?: bigint) => bigint;
    case 6:
      return poseidon6 as (elems: bigint[], initialState?: bigint) => bigint;
    default:
      throw new Error(`Unsupported n: ${n}`);
  }
}

function printTestCase(n: number, initialState: bigint): void {
  const elems = range(n).map(() => randomFp());

  const out = poseidonN(n)(elems, initialState);

  console.log(`PoseidonExtT${n + 1}`);
  console.log("initialState:", initialState);
  console.log("elems:", elems);
  console.log("out:", out);
  console.log();
}

printTestCase(2, 12345n);
printTestCase(3, 12345n);
printTestCase(6, 12345n);
