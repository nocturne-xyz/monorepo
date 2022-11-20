import { ObjectDB } from "@flax/sdk";
import { DEFAULT_SERIALIZABLE_STATE, SerializableState } from "@flax/sdk";

export class SnapDB extends ObjectDB {
  async getSerializableState(): Promise<SerializableState> {
    let maybeState = await wallet.request({
      method: "snap_manageState",
      params: ["get"],
    });

    if (!maybeState) {
      await this.storeSerializableState(DEFAULT_SERIALIZABLE_STATE);
      return DEFAULT_SERIALIZABLE_STATE;
    } else {
      return maybeState as SerializableState;
    }
  }

  async storeSerializableState(state: SerializableState): Promise<boolean> {
    await wallet.request({
      method: "snap_manageState",
      params: ["update", state],
    });
    return true;
  }
}
