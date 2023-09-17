import * as JSON from "bigint-json-serialization";
import { assert } from "./utils";
import { ExtPointType, twistedEdwards } from "@noble/curves/abstract/edwards";
import { Field } from "@noble/curves/abstract/modular";

// noble's affine point type accepts extended points for some reason, so yeah
export type AffinePoint<T> = {
  x: T;
  y: T;
}

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

// base field of the curve
const BaseField =
  Field(
    21888242871839275222246405745257275088548364400416034343698204186575808495617n
  );

// scalar field of the curve's prime-order subgroup. technically this isn't the scalar field for the curve
// overall, but we only ever use points in the subgroup, and not exporting the curve's
// scalar field this helps us prevent confusion
const ScalarField =
  Field(
    2736030358979909402780800718157159386076813972158567259200215660948447373041n
  );

const GeneratorPoint: AffinePoint<bigint> = {
  x: 995203441582195749578291179787384436505546430278305826713579947235728471134n,
  y: 5472060717959818805561601436314318772137091100104008585924551046643952123905n,
}
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
  Gx: GeneratorPoint.x,
  Gy: GeneratorPoint.y,

  // these should not be used. we only use the arithmetic from the curve
  hash: (x) => new Uint8Array(0),
  randomBytes: (n) => new Uint8Array(n ?? 0),
});

assert(babyJubJubFn.CURVE.n % babyJubJubFn.CURVE.h === 0n);

export const BabyJubJub = {
  ORDER: babyJubJubFn.CURVE.n,
  PRIME_SUBGROUP_ORDER: babyJubJubFn.CURVE.n / babyJubJubFn.CURVE.h,

  A,
  D,

  BaseField,
  ScalarField,

  // note that we don't export the generator point.
  // this is because we only ever want to use points in the prime-order subgroup
  BasePointAffine: BasePoint,
  BasePointExtended: babyJubJubFn.ExtendedPoint.fromAffine(BasePoint),

  ExtendedPoint: babyJubJubFn.ExtendedPoint,

  toString(point: AffinePoint<bigint>): string {
    return JSON.stringify(point);
  },

  // throws an error if encoding is invalid, point
  // isn't on curve, or point isn't in prime-order subgroup
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
