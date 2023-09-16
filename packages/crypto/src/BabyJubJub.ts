import * as JSON from "bigint-json-serialization";
import { assert } from "./utils";
import { AffinePoint } from "@noble/curves/abstract/curve";
import { ExtPointType, twistedEdwards } from "@noble/curves/abstract/edwards";
import { Field } from "@noble/curves/abstract/modular";

export { AffinePoint } from "@noble/curves/abstract/curve";

// HACK: noble doesn't export it's field type, so I have to infer and make an alias
export type FpField = ReturnType<typeof Field>;

export type BabyJubJubCurveType = {
  A: bigint;
  D: bigint;

  BaseField: FpField;
  ScalarField: FpField;

  BasePointAffine: AffinePoint<bigint>;
  BasePointExtended: ExtPointType;
  ExtendedPoint: ExtPointType;

  toString(point: AffinePoint<bigint>): string;
  fromString(s: string): AffinePoint<bigint>;
};

const BaseField =
  Field(
    21888242871839275222246405745257275088548364400416034343698204186575808495617n
  );
const ScalarField =
  Field(
    2736030358979909402780800718157159386076813972158567259200215660948447373041n
  );
const BasePoint: AffinePoint<bigint> = {
  x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
};

const A = BaseField.create(168700n);
const D = BaseField.create(168696n);

const babyJubJubFn = twistedEdwards({
  a: A,
  d: D,
  Fp: BaseField,
  n: 21888242871839275222246405745257275088614511777268538073601725287587578984328n,
  h: 8n,
  Gx: BasePoint.x,
  Gy: BasePoint.y,

  // these should not be used. we only use the arithmetic from the curve
  hash: (x) => new Uint8Array(0),
  randomBytes: (n) => new Uint8Array(n ?? 0),
});

export const BabyJubJub = {
  A,
  D,

  BaseField,
  ScalarField,

  BasePointAffine: BasePoint,
  BasePointExtended: babyJubJubFn.ExtendedPoint.BASE,

  ExtendedPoint: babyJubJubFn.ExtendedPoint,

  toString(point: AffinePoint<bigint>): string {
    return JSON.stringify(point);
  },

  fromString(s: string): AffinePoint<bigint> {
    const res = JSON.parse(s);
    assert(res instanceof Object);
    assert(Object.hasOwn(res, "x"));
    assert(Object.hasOwn(res, "y"));
    assert(typeof res.x === "bigint");
    assert(typeof res.y === "bigint");

    const { x, y } = res as AffinePoint<bigint>;
    const point = {
      x: BaseField.create(x),
      y: BaseField.create(y),
    };

    const ext = babyJubJubFn.ExtendedPoint.fromAffine(point);

    ext.assertValidity();
    assert(ext.isTorsionFree());

    return point;
  },
};
