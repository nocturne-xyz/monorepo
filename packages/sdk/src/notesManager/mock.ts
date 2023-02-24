/* eslint-disable */
import { NotesManager, JoinSplitEvent } from ".";
import { NotesDB, InMemoryKVStore } from "../db";
import { IncludedNote, NocturneViewer } from "@nocturne-xyz/primitives";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(new NotesDB(new InMemoryKVStore()), new NocturneViewer(1n));
  }

  protected async fetchNotesFromRefunds(): Promise<IncludedNote[]> {
    return [];
  }

  protected async postStoreNotesFromRefunds(): Promise<void> {}

  protected async fetchJoinSplits(): Promise<JoinSplitEvent[]> {
    return [];
  }

  protected async postApplyJoinSplits(): Promise<void> {}
}
