import {
  poseidon1,
  poseidon2,
  poseidon3,
  poseidon4,
  poseidon5,
  poseidon6,
  poseidon7,
  poseidon8,
  poseidon9,
  poseidon10,
  poseidon11,
  poseidon12,
  poseidon13,
  poseidon14,
  poseidon15,
  poseidon16,
  randomFp
} from "@nocturne-xyz/crypto";
import { range } from "../src";

function poseidonN(n: number): (elems: bigint[], initialState?: bigint) => bigint {
  switch (n) {
    case 1:
      return poseidon1 as (elems: bigint[], initialState?: bigint) => bigint;
    case 2:
      return poseidon2 as (elems: bigint[], initialState?: bigint) => bigint;
    case 3:
      return poseidon3 as (elems: bigint[], initialState?: bigint) => bigint;
    case 4:
      return poseidon4 as (elems: bigint[], initialState?: bigint) => bigint;
    case 5:
      return poseidon5 as (elems: bigint[], initialState?: bigint) => bigint;
    case 6:
      return poseidon6 as (elems: bigint[], initialState?: bigint) => bigint;
    case 7:
      return poseidon7 as (elems: bigint[], initialState?: bigint) => bigint;
    case 8:
      return poseidon8 as (elems: bigint[], initialState?: bigint) => bigint;
    case 9:
      return poseidon9 as (elems: bigint[], initialState?: bigint) => bigint;
    case 10:
      return poseidon10 as (elems: bigint[], initialState?: bigint) => bigint;
    case 11:
      return poseidon11 as (elems: bigint[], initialState?: bigint) => bigint;
    case 12:
      return poseidon12 as (elems: bigint[], initialState?: bigint) => bigint;
    case 13:
      return poseidon13 as (elems: bigint[], initialState?: bigint) => bigint;
    case 14:
      return poseidon14 as (elems: bigint[], initialState?: bigint) => bigint;
    case 15:
      return poseidon15 as (elems: bigint[], initialState?: bigint) => bigint;
    case 16:
      return poseidon16 as (elems: bigint[], initialState?: bigint) => bigint;
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
