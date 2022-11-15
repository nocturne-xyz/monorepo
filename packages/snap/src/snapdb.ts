import { AssetHash, IncludedNoteStruct } from "@flax/sdk";

type SnapState = {
  kv: Map<string, string>;
  notes: Map<AssetHash, IncludedNoteStruct[]>;
  leaves?: bigint[];
};

export class SnapDB {
  constructor() {
    // super();
  }

  async getSnapState(): Promise<SnapState> {
    let state = await wallet.request({
      method: "snap_manageState",
      params: ["get"],
    });

    if (!state) {
      state = { kv: {}, notes: {}, leaves: [] };
      await wallet.request({
        method: "snap_manageState",
        params: ["update", state],
      });
    }

    return state as SnapState;
  }

  async getKv(key: string): Promise<string | undefined> {
    const state = await this.getSnapState();
    return state.kv.get(key);
  }

  async putKv(key: string, value: string): Promise<boolean> {
    let state = await this.getSnapState();
    state.kv.set(key, value);

    await wallet.request({
      method: "snap_manageState",
      params: ["update", state],
    });
    return true; // update request will have thrown error if failed?
  }
}
