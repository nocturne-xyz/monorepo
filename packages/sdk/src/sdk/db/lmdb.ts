import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { open, RootDatabase } from "lmdb";
import { FlaxDB, NOTES_PREFIX } from ".";
import { IncludedNoteStruct, includedNoteStructFromJSON } from "../note";
import { Asset } from "../../commonTypes";

const ROOT_DIR = findWorkspaceRoot()!;

export class FlaxLMDB implements FlaxDB {
  db: RootDatabase<string, string>;

  constructor(dbPath?: string) {
    if (!dbPath) {
      dbPath = path.join(ROOT_DIR, "db");
    }
    this.db = open({ path: dbPath, dupSort: true, encoding: "ordered-binary" });
  }

  putKv(key: string, value: string): Promise<boolean> {
    return this.db.put(key, value);
  }

  getKv(key: string): string | undefined {
    return this.db.get(key);
  }

  storeNote(note: IncludedNoteStruct): Promise<boolean> {
    const asset = new Asset(note.asset, note.id);
    const key = FlaxDB.notesKey(asset);
    return this.putKv(key, JSON.stringify(note));
  }

  getAllNotes(): Map<string, IncludedNoteStruct[]> {
    const keys = this.db.getKeys();

    const notesMap: Map<string, IncludedNoteStruct[]> = new Map();
    for (const key of keys) {
      const notesArray: IncludedNoteStruct[] = [];
      if (key.startsWith(NOTES_PREFIX)) {
        for (const val of this.db.getValues(key)) {
          const includedNote = includedNoteStructFromJSON(val);
          notesArray.push(includedNote);
        }
        notesMap.set(key, notesArray);
      }
    }

    return notesMap;
  }
}
