import * as JSON from "bigint-json-serialization";
import { assert } from "./utils";
import { ExtPointType, twistedEdwards } from "@noble/curves/abstract/edwards";
import { AffinePoint } from "@noble/curves/abstract/curve";
import { Field } from "@noble/curves/abstract/modular";
import { sha256 } from "@noble/hashes/sha256";

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
};
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
  hash: sha256,
  randomBytes: (n) => global.crypto.getRandomValues(new Uint8Array(n ?? 32)),
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

  toBytes({ x, y }: AffinePoint<bigint>): Uint8Array {
    const xBytes = this.BaseField.toBytes(x);
    const yBytes = this.BaseField.toBytes(y);

    const res = new Uint8Array(this.BaseField.BYTES * 2);
    res.set(xBytes);
    res.set(yBytes, xBytes.length);

    return res;
  },

  // retuns an extended point - can be converted back to affine with `toAffine`
  // note that `ExtPointType` has getters for `x` and `y` that return field elements in affine coordinates
  fromBytes(bytes: Uint8Array): ExtPointType {
    assert(bytes.length === this.BaseField.BYTES * 2);

    const xBytes = bytes.slice(0, this.BaseField.BYTES);
    const yBytes = bytes.slice(this.BaseField.BYTES);

    const x = this.BaseField.fromBytes(xBytes);
    const y = this.BaseField.fromBytes(yBytes);

    assert(
      this.BaseField.isValid(x),
      "x coordinate is not a valid field element"
    );
    assert(
      this.BaseField.isValid(y),
      "y coordinate is not a valid field element"
    );

    const point = { x, y };
    const ext = babyJubJubFn.ExtendedPoint.fromAffine(point);
    ext.assertValidity();
    assert(ext.isTorsionFree(), "point is not in prime-order subgroup");

    return ext;
  },

  toString({ x, y }: AffinePoint<bigint>): string {
    // this is written like this because `ExtPointType` satisfies `AffinePoint` via its getters,
    // but `AffinePoint` doesn't satisfy `ExtPointType` because it doesn't have all of the other stuff that it has,
    // causing a different output depending on whether you plug in an extended point or an affine point
    return JSON.stringify({ x, y });
  },

  // throws an error if encoding is invalid, point
  // isn't on curve, or point isn't in prime-order subgroup
  // returns an extended point - can be converted back to affine with `toAffine`
  // note that `ExtPointType` has getters for `x` and `y` that return field elements in affine coordinates
  fromString(s: string): ExtPointType {
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
    assert(ext.isTorsionFree(), "point is not in prime-order subgroup");

    return ext;
  },
};
