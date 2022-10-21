import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";

export type Address = string;
export type AssetHash = string;

export class Asset {
  address: Address;
  id: bigint;

  constructor(address: Address, id: bigint) {
    this.address = address;
    this.id = id;
  }

  hash(): AssetHash {
    return keccak256(toUtf8Bytes(`${this.address}:${this.id.toString()}`));
  }
}

export interface AssetRequest {
  asset: Asset;
  value: bigint;
}
