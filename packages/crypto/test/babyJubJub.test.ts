import "mocha";
import { expect } from "chai";
import "./crypto";

//@ts-ignore
import { babyjub } from "circomlibjs";

import { range } from "./utils";
import { randomFr, BabyJubJub, AffinePoint } from "../src";

function randomSubgroupPoint(): AffinePoint<bigint> {
  const scalar = randomFr();
  return BabyJubJub.BasePointExtended.multiplyUnsafe(scalar).toAffine();
}

describe("BabyJubJub", () => {
  it("Order matches circomlibjs", () => {
    expect(BabyJubJub.ORDER).to.equal(babyjub.order);
  });

  it("PrimeSubgroupOrder matches circomlibjs", () => {
    expect(BabyJubJub.PRIME_SUBGROUP_ORDER).to.equal(babyjub.subOrder);
  });

  it("BasePoint matches circomlibjs", () => {
    expect(BabyJubJub.BasePointAffine.x).to.equal(babyjub.Base8[0]);
    expect(BabyJubJub.BasePointAffine.y).to.equal(babyjub.Base8[1]);
  });

  it("A matches circomlibjs", () => {
    expect(BabyJubJub.A).to.equal(babyjub.A);
  });

  it("D matches circomlibjs", () => {
    expect(BabyJubJub.D).to.equal(babyjub.D);
  });

  it("add matches circomlibjs", () => {
    range(10).forEach(() => {
      const a = randomSubgroupPoint();
      const b = randomSubgroupPoint();

      const aCircom = [a.x, a.y];
      const bCircom = [b.x, b.y];

      const expected = babyjub.addPoint(aCircom, bCircom);
      const got = BabyJubJub.ExtendedPoint.fromAffine(a).add(BabyJubJub.ExtendedPoint.fromAffine(b)).toAffine();
      expect(got.x).to.equal(expected[0]);
      expect(got.y).to.equal(expected[1]);
    });
  });

  it("double matches circomlibjs", () => {
    range(10).forEach(() => {
      const point = randomSubgroupPoint();
      const pointCircom = [point.x, point.y];

      const expected = babyjub.addPoint(pointCircom, pointCircom);
      const got = BabyJubJub.ExtendedPoint.fromAffine(point).double().toAffine();

      expect(got.x).to.equal(expected[0]);
      expect(got.y).to.equal(expected[1]);
    });
  });

  it("constant time scalar mul matches circomlibjs", () => {
    range(10).forEach(() => {
      const point = randomSubgroupPoint();
      const pointCircom = [point.x, point.y];

      const scalar = randomFr();

      const expected = babyjub.mulPointEscalar(pointCircom, scalar);

      const got = BabyJubJub.ExtendedPoint.fromAffine(point).multiply(scalar).toAffine();

      expect(got.x).to.equal(expected[0]);
      expect(got.y).to.equal(expected[1]);
    });
  });

  it("vartime scalar mul matches circomlibjs", () => {
    range(10).forEach(() => {
      const point = randomSubgroupPoint();
      const pointCircom = [point.x, point.y];

      const scalar = randomFr();

      const expected = babyjub.mulPointEscalar(pointCircom, scalar);
      const got = BabyJubJub.ExtendedPoint.fromAffine(point).multiplyUnsafe(scalar);

      expect(got.x).to.equal(expected[0]);
      expect(got.y).to.equal(expected[1]);
    });
  });

  it("toString matches fromString", () => {
    range(10).forEach(() => {
      const point = randomSubgroupPoint();

      const pointString = BabyJubJub.toString(point);
      const got = BabyJubJub.fromString(pointString);
      expect(got.x).to.equal(point.x);
      expect(got.y).to.equal(point.y);
    });
  });
});
