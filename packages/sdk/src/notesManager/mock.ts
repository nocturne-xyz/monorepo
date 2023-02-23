/* eslint-disable */
import { NotesManager, JoinSplitEvent } from ".";
import { NotesDB, InMemoryKVStore } from "../db";
import { IncludedNote, NocturneSigner } from "@nocturne-xyz/primitives";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(new NotesDB(new InMemoryKVStore()), new NocturneSigner(1n));
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
