import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { open, RootDatabase } from "lmdb";
import { FlaxDB, NOTES_PREFIX } from ".";
import { IncludedNote, IncludedNoteStruct } from "../note";

const ROOT_DIR = findWorkspaceRoot()!;

export class FlaxLMDB implements FlaxDB {
  db: RootDatabase<string, string>;

  constructor(dbPath?: string) {
    if (!dbPath) {
      dbPath = path.join(ROOT_DIR, "db");
    }
    this.db = open({ path: dbPath });
  }

  putKv(key: string, value: string): Promise<boolean> {
    return this.db.put(key, value);
  }

  getKv(key: string): string | undefined {
    return this.db.get(key);
  }

  storeNote(note: IncludedNote): Promise<boolean> {
    const key = FlaxDB.notesKey(note.getAsset());
    return this.putKv(key, JSON.stringify(note));
  }

  getAllNotes(): Map<string, IncludedNoteStruct[]> {
    const keys = this.db.getKeys();

    let notesMap: Map<string, IncludedNoteStruct[]> = new Map();
    for (const key of keys) {
      if (key.startsWith(NOTES_PREFIX)) {
        const notesArrayString = this.getKv(key)!;
        const notesArray: IncludedNoteStruct[] = JSON.parse(notesArrayString);
        notesMap.set(key, notesArray);
      }
    }

    return notesMap;
  }
}
