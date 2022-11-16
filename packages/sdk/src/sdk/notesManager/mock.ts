/* tslint:disable */
import { NotesManager, SpendEvent } from ".";
import { IncludedNoteStruct } from "../note";

export class MockNotesManager extends NotesManager {
  protected async fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]> {
    return [];
  }

  protected async postStoreNotesFromRefunds(): Promise<void> {}

  protected async fetchSpends(): Promise<SpendEvent[]> {
    return [];
  }

  protected async postApplySpends(): Promise<void> {}
}
