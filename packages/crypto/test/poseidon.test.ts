import "mocha";
import { expect } from "chai";
import "./crypto";

//@ts-ignore
import { poseidon } from "circomlibjs";
import { randomFp, poseidon1, poseidon2, poseidon3 } from "../src";
import { range } from "./utils";
import { poseidon15, poseidon6 } from "../src/hashes";

describe("Poseidon", () => {
  it("matches circomlibjs with 1 input", () => {
    range(30)
      .map((_) => range(1).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidon1(inputs as [bigint])).to.equal(c);
      });
  });

  it("matches circomlibjs with 2 inputs", () => {
    range(30)
      .map((_) => range(2).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidon2(inputs as [bigint, bigint])).to.equal(c);
      });
  });

  it("matches circomlibjs with 3 inputs", () => {
    range(30)
      .map((_) => range(3).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidon3(inputs as [bigint, bigint, bigint])).to.equal(c);
      });
  });

  it("matches circomlibjs with 6 inputs", () => {
    range(30)
      .map((_) => range(6).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(
          poseidon6(inputs as [bigint, bigint, bigint, bigint, bigint, bigint])
        ).to.equal(c);
      });
  });

  it("matches circomlibjs with 15 inputs", () => {
    range(30)
      .map((_) => range(15).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(
          poseidon15(
            inputs as [
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint
            ]
          )
        ).to.equal(c);
      });
  });
});
