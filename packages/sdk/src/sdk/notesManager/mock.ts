/* eslint-disable */
import { NotesManager, JoinSplitEvent } from ".";
import { NocturnePrivKey } from "../../crypto";
import { NotesDB, InMemoryKVStore } from "../db";
import { IncludedNote } from "../note";
import { NocturneSigner } from "../signer";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(
      new NotesDB(new InMemoryKVStore()),
      new NocturneSigner(new NocturnePrivKey(1n))
    );
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
