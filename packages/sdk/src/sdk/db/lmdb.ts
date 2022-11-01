import { open, RootDatabase, Database } from "lmdb";
import { DEFAULT_DB_PATH, FlaxDB, NOTES_PREFIX } from ".";
import { IncludedNoteStruct, includedNoteStructFromJSON } from "../note";
import { Asset } from "../../commonTypes";

export class FlaxLMDB implements FlaxDB {
  rootDb: RootDatabase<string, string>;
  kvDb: Database<string, string>;
  notesDb: Database<string, string>;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.rootDb = open({
      path: dbPath,
    });
    this.kvDb = this.rootDb.openDB({ name: "kv" });
    this.notesDb = this.rootDb.openDB({
      name: "notes",
      dupSort: true,
      encoding: "ordered-binary",
      sharedStructuresKey: Symbol.for(NOTES_PREFIX),
    });
  }

  putKv(key: string, value: string): Promise<boolean> {
    return this.kvDb.put(key, value);
  }

  getKv(key: string): string | undefined {
    return this.kvDb.get(key);
  }

  storeNote(note: IncludedNoteStruct): Promise<boolean> {
    const asset = new Asset(note.asset, note.id);
    const key = FlaxDB.notesKey(asset);
    return this.notesDb.put(key, JSON.stringify(note));
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
  }

  async close(): Promise<void> {
    await this.rootDb.close();
  }
}
