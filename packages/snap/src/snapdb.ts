import {
  AssetStruct,
  FlaxDB,
  hashAsset,
  IncludedNoteStruct,
  includedNoteStructFromJSON,
} from "@flax/sdk";

const DEFAULT_SNAP_STATE = {
  kv: new Map<string, string>(),
  notes: new Map<string, JSONNote[]>(),
  leaves: [],
};

type JSONNote = string;
type SnapState = {
  kv: Map<string, string>;
  notes: Map<string, JSONNote[]>;
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
      state = DEFAULT_SNAP_STATE;
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
    state.kv.set(key, value);

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  async removeKv(key: string): Promise<boolean> {
    const state = await this.getSnapState();
    state.kv.delete(key);

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  async storeNote(note: IncludedNoteStruct): Promise<boolean> {
    const state = await this.getSnapState();

    const key = FlaxDB.notesKey({ address: note.asset, id: note.id });
    state.notes.set(
      key,
      (state.notes.get(key) ?? []).concat([JSON.stringify(note)])
    );

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  // async removeNote(note: IncludedNoteStruct): Promise<boolean> {
  //   const state = await this.getSnapState();

  //   const key = FlaxDB.notesKey({ address: note.asset, id: note.id });
  //   state.notes.set(
  //     key,
  //     (state.notes.get(key) ?? []).filter(
  //       (jsonNote) => jsonNote != JSON.stringify(note)
  //     )
  //   );

  //   await wallet.request({
  //     method: "snap_manageState",
  //     params: ["update", snapStateToObject(state)],
  //   });
  //   return true;
  // }

  // async getAllNotes(): Promise<Map<string, IncludedNoteStruct[]>> {
  //   const state = await this.getSnapState();

  //   const notesMap: Map<string, IncludedNoteStruct[]> = new Map();
  //   for (const [assetHash, jsonNotes] of state.notes.entries()) {
  //     const notes = jsonNotes.map(includedNoteStructFromJSON);
  //     notesMap.set(assetHash, notes);
  //   }

  //   return notesMap;
  // }

  // async getNotesFor(asset: AssetStruct): Promise<IncludedNoteStruct[]> {
  //   const state = await this.getSnapState();
  //   const jsonNotesFor = state.notes.get(hashAsset(asset)) ?? [];
  //   return jsonNotesFor.map(includedNoteStructFromJSON);
  // }

  // async clear(): Promise<void> {
  //   await wallet.request({
  //     method: "snap_manageState",
  //     params: ["update", DEFAULT_SNAP_STATE],
  //   });
  // }

  // async close(): Promise<void> {
  //   return new Promise(() => {}); // no close function for snap
  // }
}
