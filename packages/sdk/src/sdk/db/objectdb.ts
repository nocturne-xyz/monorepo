import { NocturneDB, LocalMerkleDBExtension } from ".";
import { Asset } from "../../commonTypes";
import { IncludedNote } from "../note";

export const DEFAULT_SERIALIZABLE_STATE: SerializableState = {
  kv: {},
  notes: {},
  leaves: {},
};

type JSONNote = string;
type BigIntString = string;
export type SerializableState = {
  kv: { [key: string]: string };
  notes: { [key: string]: JSONNote[] };
  leaves?: { [key: string]: BigIntString };
};

export type StructuredState = {
  kv: Map<string, string>;
  notes: Map<string, IncludedNote[]>;
  leaves?: Map<string, bigint>;
};

export function serializableToStructuredState(
  state: SerializableState
): StructuredState {
  const kv = new Map(Object.entries(state.kv));
  const notes = new Map(
    Object.entries(state.notes).map(([key, val]) => [
      key,
      val.map((v) => JSON.parse(v) as IncludedNote),
    ])
  );
  const leaves = state.leaves
    ? new Map(
        Object.entries(state.leaves).map(([key, val]) => [key, BigInt(val)])
      )
    : new Map<string, bigint>();

  return {
    kv,
    notes,
    leaves,
  };
}

export function structuredToSerializableState(
  state: StructuredState
): SerializableState {
  const kv = Object.fromEntries(state.kv);

  const notesMap = new Map(
    Array.from(state.notes).map(([key, value]) => [
      key,
      value.map((v) => JSON.stringify(v)),
    ])
  );
  const notes = Object.fromEntries(notesMap);

  const leavesMap = new Map(
    Array.from(state.leaves!).map(([key, value]) => [key, value.toString()])
  );
  const leaves = Object.fromEntries(leavesMap);

  return {
    kv,
    notes,
    leaves,
  };
}

export abstract class ObjectDB extends NocturneDB {
  abstract getSerializableState(): Promise<SerializableState>;

  abstract storeSerializableState(state: SerializableState): Promise<boolean>;

  async getState(): Promise<StructuredState> {
    const serializable = await this.getSerializableState();
    return serializableToStructuredState(serializable);
  }

  async storeState(state: StructuredState): Promise<boolean> {
    const serialzable = structuredToSerializableState(state);
    await this.storeSerializableState(serialzable);
    return true;
  }

  async getStructuredState(): Promise<StructuredState> {
    const maybeState = await this.getSerializableState();

    if (!maybeState) {
      const defaultState = serializableToStructuredState(
        DEFAULT_SERIALIZABLE_STATE
      );
      await this.storeState(defaultState);
      return defaultState;
    } else {
      return serializableToStructuredState(maybeState);
    }
  }

  async getKv(key: string): Promise<string | undefined> {
    const state = await this.getStructuredState();
    return state.kv.get(key);
  }

  async putKv(key: string, value: string): Promise<boolean> {
    const state = await this.getStructuredState();
    state.kv.set(key, value);

    await this.storeState(state);
    return true;
  }

  async removeKv(key: string): Promise<boolean> {
    const state = await this.getStructuredState();
    state.kv.delete(key);

    await this.storeState(state);
    return true;
  }

  async storeNote(note: IncludedNote): Promise<boolean> {
    const state = await this.getStructuredState();

    const key = NocturneDB.formatNotesKey(note.asset);
    const existingNotesFor = state.notes.get(key) ?? [];

    if (existingNotesFor.includes(note)) {
      return true;
    }

    state.notes.set(key, existingNotesFor.concat([note]));
    await this.storeState(state);
    return true;
  }

  async removeNote(note: IncludedNote): Promise<boolean> {
    const state = await this.getStructuredState();

    const key = NocturneDB.formatNotesKey(note.asset);
    state.notes.set(
      key,
      (state.notes.get(key) ?? []).filter(
        (n) => JSON.stringify(n) != JSON.stringify(note)
      )
    );

    await this.storeState(state);
    return true;
  }

  async getAllNotes(): Promise<Map<string, IncludedNote[]>> {
    const state = await this.getStructuredState();

    const notesMap: Map<string, IncludedNote[]> = new Map();
    for (const [assetString, notes] of state.notes.entries()) {
      notesMap.set(assetString, notes);
    }

    return notesMap;
  }

  async getNotesFor(asset: Asset): Promise<IncludedNote[]> {
    const state = await this.getStructuredState();
    return state.notes.get(NocturneDB.formatNotesKey(asset)) ?? [];
  }

  async clear(): Promise<void> {
    await this.storeState(
      serializableToStructuredState(DEFAULT_SERIALIZABLE_STATE)
    );
  }

  async close(): Promise<void> {}

  async storeLeaf(index: number, leaf: bigint): Promise<boolean> {
    const state = await this.getStructuredState();

    if (!state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when DB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    state.leaves.set(key, leaf);

    await this.storeState(state);
    return true;
  }

  async getLeaf(index: number): Promise<bigint | undefined> {
    const state = await this.getStructuredState();
    if (!state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when DB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    const maybeLeaf = state.leaves.get(key);
    return maybeLeaf !== undefined ? BigInt(maybeLeaf) : undefined;
  }
}
