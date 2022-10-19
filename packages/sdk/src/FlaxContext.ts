import { Address, Asset } from "./commonTypes";
import { Action } from "./contract/types";
import { SpendableNote } from "./sdk/note";

export interface SpendRequest {
  token: Address;
  id: bigint;
  value: bigint;
  actions: Action[];
}

export class FlaxContext {
  dbPath: string = "/flaxdb";
  tokenToNotes: Map<Asset, SpendableNote>;

  // TODO: pull spendable notes from db
  constructor() {
    this.tokenToNotes = new Map();
  }

  // TODO: sync owned notes from AWS bucket
  async sync() {}

  formatOperation(request: SpendRequest) {}
}
