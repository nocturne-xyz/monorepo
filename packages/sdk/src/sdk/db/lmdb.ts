import { open, RootDatabase, Database } from "lmdb";
import {
  DEFAULT_DB_PATH,
  FlaxDB,
  LEAVES_PREFIX,
  LocalMerkleDBExtension,
  NOTES_PREFIX,
} from ".";
import { IncludedNoteStruct, includedNoteStructFromJSON } from "../note";
import { Asset } from "../../commonTypes";

export interface FlaxLMDBOptions {
  dbPath?: string;
  localMerkle?: boolean;
}

export class FlaxLMDB extends FlaxDB implements LocalMerkleDBExtension {
  rootDb: RootDatabase<string, string>;
  kvDb: Database<string, string>;
  notesDb: Database<string, string>;
  leavesDb?: Database<string, string>;

  constructor(options?: FlaxLMDBOptions) {
    super();

    this.rootDb = open({
      path: options?.dbPath ?? DEFAULT_DB_PATH,
    });
    this.kvDb = this.rootDb.openDB({ name: "kv" });
    this.notesDb = this.rootDb.openDB({
      name: "notes",
      dupSort: true,
      encoding: "ordered-binary",
      sharedStructuresKey: Symbol.for(NOTES_PREFIX),
    });

    if (options?.localMerkle) {
      this.leavesDb = this.rootDb.openDB({
        name: "leaves",
        sharedStructuresKey: Symbol.for(LEAVES_PREFIX),
      });
    }
  }

  putKv(key: string, value: string): Promise<boolean> {
    return this.kvDb.put(key, value);
  }

  getKv(key: string): string | undefined {
    return this.kvDb.get(key);
  }

  removeKv(key: string): Promise<boolean> {
    return this.kvDb.remove(key);
  }

  storeNote(note: IncludedNoteStruct): Promise<boolean> {
    const asset = new Asset(note.asset, note.id);
    const key = FlaxDB.notesKey(asset);
    return this.notesDb.put(key, JSON.stringify(note));
  }

  removeNote(note: IncludedNoteStruct): Promise<boolean> {
    const asset = new Asset(note.asset, note.id);
    const key = FlaxDB.notesKey(asset);
    return this.notesDb.remove(key, JSON.stringify(note));
  }

  getAllNotes(): Map<string, IncludedNoteStruct[]> {
    const keys = this.notesDb.getKeys();

    const notesMap: Map<string, IncludedNoteStruct[]> = new Map();
    for (const key of keys) {
      const notesArray: IncludedNoteStruct[] = [];
      for (const val of this.notesDb.getValues(key)) {
        const includedNote = includedNoteStructFromJSON(val);
        notesArray.push(includedNote);
      }
      notesMap.set(key, notesArray);
    }

    return notesMap;
  }

  clear(): void {
    this.kvDb.clearSync();
    this.notesDb.clearSync();
    this.rootDb.clearSync();
    this.leavesDb?.clearSync();
  }

  async close(): Promise<void> {
    await this.rootDb.close();
  }

  storeLeaf(index: number, leaf: bigint): Promise<boolean> {
    if (!this.leavesDb) {
      throw Error(
        "Attempted to merkle store leaf when LMDB configured without leaf storage"
      );
    }

    const key = LocalMerkleDBExtension.leafKey(index);
    return this.leavesDb.put(key, leaf.toString());
  }

  getLeaf(index: number): bigint | undefined {
    if (!this.leavesDb) {
      throw Error(
        "Attempted to merkle store leaf when LMDB configured without leaf storage"
      );
    }

    const leafString = this.leavesDb.get(LocalMerkleDBExtension.leafKey(index));

    if (!leafString) {
      return undefined;
    }

    return BigInt(leafString);
  }
}
