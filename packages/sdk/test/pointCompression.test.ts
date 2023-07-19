import "mocha";
import { expect } from "chai";
import { AffinePoint, BabyJubJub } from "@nocturne-xyz/crypto-utils";
import {
  compressPoint,
  decompressPoint,
  decomposeCompressedPoint,
  randomFr,
  range,
} from "../src";

const F = BabyJubJub.BaseField;

const SIGN_MASK = 1n << 255n;
const P_MINUS_1_OVER_2 = F.div(F.sub(F.Modulus, F.One), F.Two);

describe("point compression and decompression", () => {
  it("compressing and decompressing a point gives the same point", () => {
    range(30).forEach(() => {
      const point = randomPoint();

      const compressed = compressPoint(point);
      const decompressed = decompressPoint(compressed);

      expect(decompressed).to.deep.equal(point);
    });
  });

  it("can compress and decompress the neutral element", () => {
    const point = { x: 0n, y: 1n };
    const compressed = compressPoint(point);
    const decompressed = decompressPoint(compressed);

    expect(decompressed).to.deep.equal(point);
  });

  it("decompressPoint() returns unfedined when x is 0 and sign bit is set", () => {
    const point = { x: 0n, y: 1n };

    const compressed = compressPoint(point);
    const invalidEncoding = compressed | SIGN_MASK;
    const decompressed = decompressPoint(invalidEncoding);

    expect(decompressed).to.be.undefined;
  });

  it("decompressPoint() retruns undefined when point is not on curve", () => {
    const pointNotOnCurve = { x: 1n, y: 2n };

    const compressed = compressPoint(pointNotOnCurve);
    const decompressed = decompressPoint(compressed);

    expect(decompressed).to.be.undefined;
  });

  it("decompressPoint() returns undefined when lower 254 bits don't represent a valid field element", () => {
    {
      const pointWithInvalidYCoordinate = {
        x: 1n,
        y: BabyJubJub.BaseField.Modulus + 1n,
      };
      const compressed = compressPoint(pointWithInvalidYCoordinate);
      const decompressed = decompressPoint(compressed);

      expect(decompressed).to.be.undefined;
    }

    {
      const pointWithInvalidYCoordinate = {
        x: 1n,
        y: BabyJubJub.BaseField.Modulus,
      };
      const compressed = compressPoint(pointWithInvalidYCoordinate);
      const decompressed = decompressPoint(compressed);

      expect(decompressed).to.be.undefined;
    }
  });

  it("decompressPoint() returns undefined when encoding is out of bounds", () => {
    {
      const c = (BabyJubJub.BaseField.Modulus | SIGN_MASK) + 1n;
      const decompressed = decompressPoint(c);

      expect(decompressed).to.be.undefined;
    }

    {
      const c = BabyJubJub.BaseField.Modulus | SIGN_MASK;
      const decompressed = decompressPoint(c);

      expect(decompressed).to.be.undefined;
    }
  });

  it("decomposeCompressedPoint() works", () => {
    range(30).forEach(() => {
      const point = randomPoint();
      const c = compressPoint(point);

      const [sign, y] = decomposeCompressedPoint(c);

      expect(sign).to.equal(point.x > P_MINUS_1_OVER_2);
      expect(y).to.equal(point.y);
    });
  });
});

function randomPoint(): AffinePoint<bigint> {
  return BabyJubJub.scalarMul(BabyJubJub.BasePoint, randomFr());
}
