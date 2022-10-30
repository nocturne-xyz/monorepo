import { IncludedNote } from "../note";

export interface NotesManager {
  gatherNewRefunds(): Promise<IncludedNote[]>;
  // TODO: abstract gatherNewSpends():
  // TODO: method to call two gather functions and update DB accordingly
}

export * from "./local";
