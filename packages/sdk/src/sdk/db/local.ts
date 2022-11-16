/* tslint:disable */
import { FlaxDB, LocalMerkleDBExtension } from ".";
import { IncludedNoteStruct } from "../note";
import { AssetHash, AssetStruct } from "../../commonTypes";
import * as _ from "lodash";

interface LocalFlaxDBState {
  kv: Map<string, string>;
  notes: Map<AssetHash, IncludedNoteStruct[]>;
  leaves?: Map<string, bigint>;
}

interface LocalFlaxDBOptions {
  localMerkle?: boolean;
}

export class LocalFlaxDB extends FlaxDB implements LocalMerkleDBExtension {
  state: LocalFlaxDBState;

  constructor(options?: LocalFlaxDBOptions) {
    super();
    this.state = {
      kv: new Map(),
      notes: new Map(),
      leaves: options?.localMerkle ? new Map() : undefined,
    };
  }

  async getKv(key: string): Promise<string | undefined> {
    return this.state.kv.get(key);
  }

  async putKv(key: string, value: string): Promise<boolean> {
    this.state.kv.set(key, value);
    return true;
  }

  async removeKv(key: string): Promise<boolean> {
    this.state.kv.delete(key);
    return true;
  }

  async storeNote(note: IncludedNoteStruct): Promise<boolean> {
    const key = FlaxDB.notesKey({ address: note.asset, id: note.id });
    this.state.notes.set(key, (this.state.notes.get(key) ?? []).concat(note));
    return true;
  }

  async removeNote(note: IncludedNoteStruct): Promise<boolean> {
    const key = FlaxDB.notesKey({ address: note.asset, id: note.id });
    this.state.notes.set(
      key,
      (this.state.notes.get(key) ?? []).filter((n) => !_.isEqual(n, note))
    );
    return true;
  }

  async getAllNotes(): Promise<Map<string, IncludedNoteStruct[]>> {
    const notes = this.state.notes;
    return notes;
  }

  async getNotesFor(asset: AssetStruct): Promise<IncludedNoteStruct[]> {
    const key = FlaxDB.notesKey(asset);
    return this.state.notes.get(key) ?? [];
  }

  async clear(): Promise<void> {
    this.state = {
      kv: new Map(),
      notes: new Map(),
      leaves: new Map(),
    };
  }

  async close(): Promise<void> {}

  async storeLeaf(index: number, leaf: bigint): Promise<boolean> {
    if (!this.state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when LMDB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    this.state.leaves.set(key, leaf);
    return true;
  }

  async getLeaf(index: number): Promise<bigint | undefined> {
    if (!this.state.leaves) {
      throw Error(
        "Attempted to merkle store leaf when LMDB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    return this.state.leaves.get(key);
  }
}
