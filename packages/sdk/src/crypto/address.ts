import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/circuit-utils";
import { assertOrErr } from "../utils";
import * as JSON from "bigint-json-serialization";
import { randomFr } from "./utils";
import {
  CompressedPoint,
  compressPoint,
  decompressPoint,
} from "./pointEncoding";

export interface StealthAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export interface CompressedStealthAddress {
  h1: CompressedPoint;
  h2: CompressedPoint;
}

export type CanonAddress = AffinePoint<bigint>;

export interface AddressPoints {
  h1: AffinePoint<bigint>;
  h2: AffinePoint<bigint>;
}

export class StealthAddressTrait {
  static toPoints(flattened: StealthAddress): AddressPoints {
    return {
      h1: { x: flattened.h1X, y: flattened.h1Y },
      h2: { x: flattened.h2X, y: flattened.h2Y },
    };
  }

  static fromPoints(addressPoints: AddressPoints): StealthAddress {
    const { h1, h2 } = addressPoints;
    return {
      h1X: h1.x,
      h1Y: h1.y,
      h2X: h2.x,
      h2Y: h2.y,
    };
  }

  // TODO: remove
  static fromCompressedPoints(
    H1Comprsesed: CompressedPoint,
    H2Compressed: CompressedPoint
  ): StealthAddress {
    const H1 = decompressPoint(H1Comprsesed);
    const H2 = decompressPoint(H2Compressed);

    if (!H1 || !H2) {
      throw new Error("Invalid stealth address");
    }

    return StealthAddressTrait.fromPoints({ h1: H1, h2: H2 });
  }

  static decompress(address: CompressedStealthAddress): StealthAddress {
    return StealthAddressTrait.fromCompressedPoints(address.h1, address.h2);
  }

  static compress(address: StealthAddress): CompressedStealthAddress {
    const points = StealthAddressTrait.toPoints(address);
    const h1 = compressPoint(points.h1);
    const h2 = compressPoint(points.h2);

    return {
      h1,
      h2,
    };
  }

  static toString(address: StealthAddress): string {
    const { h1, h2 } = StealthAddressTrait.toPoints(address);
    const h1Str = BabyJubJub.toString(h1);
    const h2Str = BabyJubJub.toString(h2);

    return JSON.stringify([h1Str, h2Str]);
  }

  static fromString(str: string): StealthAddress {
    const parsed = JSON.parse(str);
    assertOrErr(Array.isArray(parsed), "StealthAddress must be an array");
    assertOrErr(parsed.length === 2, "StealthAddress must have 2 elements");
    const [h1Str, h2Str] = parsed;

    assertOrErr(
      typeof h1Str === "string",
      "StealthAddress h1 must be a string"
    );
    assertOrErr(
      typeof h2Str === "string",
      "StealthAddress h2 must be a string"
    );

    const h1 = BabyJubJub.fromString(h1Str);
    const h2 = BabyJubJub.fromString(h2Str);

    assertOrErr(
      BabyJubJub.isInSubgroup(h1),
      "StealthAddress h1 is not in subgroup"
    );
    assertOrErr(
      BabyJubJub.isInSubgroup(h2),
      "StealthAddress h2 is not in subgroup"
    );

    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static hash(address: StealthAddress): bigint {
    const { h1X, h2X } = address;
    return BigInt(poseidonBN([h1X, h2X]));
  }

  static randomize(address: StealthAddress): StealthAddress {
    const points = StealthAddressTrait.toPoints(address);
    const r = randomFr();

    const h1 = BabyJubJub.scalarMul(points.h1, r);
    const h2 = BabyJubJub.scalarMul(points.h2, r);
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  static fromCanonAddress(canonAddr: CanonAddress): StealthAddress {
    return {
      h1X: BigInt(BabyJubJub.BasePoint.x),
      h1Y: BigInt(BabyJubJub.BasePoint.y),
      h2X: BigInt(canonAddr.x),
      h2Y: BigInt(canonAddr.y),
    };
  }
}
