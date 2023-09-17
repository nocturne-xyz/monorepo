import "mocha";
import { expect } from "chai";
import "./crypto";

//@ts-ignore
import { poseidon } from "circomlibjs";
import { randomFp, poseidonBN } from "../src";
import { range } from "./utils";

describe("Poseidon", () => {
  it("matches circomlibjs with 1 input", () => {
    range(30)
      .map((_) => range(1).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidonBN(inputs)).to.equal(c);
      });
  });

  it("matches circomlibjs with 2 inputs", () => {
    range(30)
      .map((_) => range(2).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidonBN(inputs)).to.equal(c);
      });
  });

  it("matches circomlibjs with 3 inputs", () => {
    range(30)
      .map((_) => range(3).map((_) => randomFp())) 
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidonBN(inputs)).to.equal(c);
      });
  });

  it("matches circomlibjs with 6 inputs", () => {
    range(30)
      .map((_) => range(6).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidonBN(inputs)).to.equal(c);
      });
  });

  it("matches circomlibjs with 15 inputs", () => {
    range(30)
      .map((_) => range(15).map((_) => randomFp()))
      .forEach((inputs) => {
        const c = poseidon(inputs);
        expect(poseidonBN(inputs)).to.equal(c);
      });
  });
});
