import { BabyJubJub } from "./BabyJubJub";
import { CanonAddress, StealthAddress, StealthAddressTrait } from "./address";
import { ViewingKey } from "./keys";
import { randomFr } from "./rand";

export class NocturneViewer {
  vk: ViewingKey;
  vkNonce: bigint;
  _canonicalAddress: CanonAddress | null = null;

  constructor(vk: ViewingKey, vkNonce: bigint) {
    this.vk = vk;
    this.vkNonce = vkNonce;
  }

  canonicalAddress(): CanonAddress {
    if (this._canonicalAddress) {
      return this._canonicalAddress;
    }

    this._canonicalAddress = BabyJubJub.BasePointExtended.multiply(
      this.vk
    ).toAffine();
    return this._canonicalAddress;
  }

  canonicalStealthAddress(): StealthAddress {
    const canonAddr = this.canonicalAddress();
    return {
      h1X: BabyJubJub.BasePointAffine.x,
      h1Y: BabyJubJub.BasePointAffine.y,
      h2X: canonAddr.x,
      h2Y: canonAddr.y,
    };
  }

  generateRandomStealthAddress(): StealthAddress {
    const r = randomFr();
    const h1 = BabyJubJub.BasePointExtended.multiply(r);
    const h2 = h1.multiply(this.vk);

    return StealthAddressTrait.fromPoints({
      h1: h1.toAffine(),
      h2: h2.toAffine(),
    });
  }

  isOwnAddress(addr: StealthAddress): boolean {
    const points = StealthAddressTrait.toPoints(addr);
    const pointsExt = {
      h1: BabyJubJub.ExtendedPoint.fromAffine(points.h1),
      h2: BabyJubJub.ExtendedPoint.fromAffine(points.h2),
    };

    const h2Prime = pointsExt.h1.multiply(this.vk);

    return pointsExt.h2.equals(h2Prime);
  }
}
