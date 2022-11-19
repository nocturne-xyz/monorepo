import {
  AssetStruct,
  FlaxDB,
  IncludedNoteStruct,
  includedNoteStructFromJSON,
  includedNoteStructToJSON,
  LocalMerkleDBExtension,
} from "@flax/sdk";

const DEFAULT_SNAP_STATE: SnapState = {
  kv: new Map<string, string>(),
  notes: new Map<string, JSONNote[]>(),
  leaves: new Map<string, BigIntString>(),
};

type JSONNote = string;
type BigIntString = string;
type SnapState = {
  kv: Map<string, string>;
  notes: Map<string, JSONNote[]>;
  leaves: Map<string, BigIntString>;
};

/**
 *
 * @param obj
 */
export function objectToSnapState(obj: any): SnapState {
  return {
    kv: new Map(Object.entries(obj.kv)),
    notes: new Map(Object.entries(obj.notes)),
    leaves: new Map(Object.entries(obj.leaves)),
  };
}

/**
 *
 * @param state
 */
export function snapStateToObject(state: SnapState): any {
  return {
    kv: Object.fromEntries(state.kv),
    notes: Object.fromEntries(state.notes),
    leaves: Object.fromEntries(state.leaves),
  };
}

export class SnapDB extends LocalMerkleDBExtension {
  async getSnapState(): Promise<SnapState> {
    let maybeState = await wallet.request({
      method: "snap_manageState",
      params: ["get"],
    });

    let state;
    if (!maybeState) {
      state = DEFAULT_SNAP_STATE;
      await wallet.request({
        method: "snap_manageState",
        params: ["update", snapStateToObject(state)],
      });
    } else {
      state = objectToSnapState(maybeState);
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
    const existingNotesFor = state.notes.get(key) ?? [];

    const jsonNote = includedNoteStructToJSON(note);
    if (existingNotesFor.includes(jsonNote)) {
      return true;
    }

    state.notes.set(key, existingNotesFor.concat([jsonNote]));
    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  async removeNote(note: IncludedNoteStruct): Promise<boolean> {
    const state = await this.getSnapState();

    const key = FlaxDB.notesKey({ address: note.asset, id: note.id });
    state.notes.set(
      key,
      (state.notes.get(key) ?? []).filter(
        (n) => n !== includedNoteStructToJSON(note)
      )
    );

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  async getAllNotes(): Promise<Map<string, IncludedNoteStruct[]>> {
    const state = await this.getSnapState();

    const notesMap: Map<string, IncludedNoteStruct[]> = new Map();
    for (const [assetHash, jsonNotes] of state.notes.entries()) {
      const notes = [...jsonNotes].map(includedNoteStructFromJSON);
      notesMap.set(assetHash, notes);
    }

    return notesMap;
  }

  async getNotesFor(asset: AssetStruct): Promise<IncludedNoteStruct[]> {
    const state = await this.getSnapState();
    const jsonNotesFor = state.notes.get(FlaxDB.notesKey(asset)) ?? [];
    return jsonNotesFor.map(includedNoteStructFromJSON);
  }

  async clear(): Promise<void> {
    console.log(snapStateToObject(DEFAULT_SNAP_STATE));
    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(DEFAULT_SNAP_STATE)],
    });
  }

  async close(): Promise<void> {
    return new Promise(() => {}); // no close function for snap
  }

  async storeLeaf(index: number, leaf: bigint): Promise<boolean> {
    const state = await this.getSnapState();

    if (!state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when DB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);

    state.leaves.set(key, leaf.toString());

    await wallet.request({
      method: "snap_manageState",
      params: ["update", snapStateToObject(state)],
    });
    return true;
  }

  async getLeaf(index: number): Promise<bigint | undefined> {
    const state = await this.getSnapState();
    if (!state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when DB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    const maybeLeaf = state.leaves.get(key);
    return maybeLeaf ? BigInt(maybeLeaf) : undefined;
  }
}
