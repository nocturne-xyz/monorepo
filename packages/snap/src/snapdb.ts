import { AssetHash } from "@flax/sdk";

type SnapState = {
  kv: Map<string, string>;
  notes: Map<AssetHash, string>;
  leaves: bigint[];
};

function objectToSnapState(obj: any): SnapState {
  return {
    kv: new Map(Object.entries(obj.kv)),
    notes: new Map(Object.entries(obj.notes)),
    leaves: obj.leaves,
  };
}

function snapStateToObject(state: SnapState): any {
  return {
    kv: Object.fromEntries(state.kv),
    notes: Object.fromEntries(state.notes),
    leaves: state.leaves,
  };
}

export class SnapDB {
  constructor() {
    // super();
  }

  async getSnapState(): Promise<SnapState> {
    let state = objectToSnapState(
      await wallet.request({
        method: "snap_manageState",
        params: ["get"],
      })
    );

    if (!state) {
      state = { kv: new Map(), notes: new Map(), leaves: [] };
      await wallet.request({
        method: "snap_manageState",
        params: ["update", state],
      });
    }

    return state;
  }

  async getKv(key: string): Promise<string | undefined> {
    const state = await this.getSnapState();
    return state.kv.get(key);
  }

  async putKv(key: string, value: string): Promise<boolean> {
    const state = await this.getSnapState();
    console.log("STATE: ", state.kv);
    state.kv.set(key, value);

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true; // update request will have thrown error if failed?
  }
}
