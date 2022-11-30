/* eslint-disable */
import { NotesManager, JoinSplitEvent } from ".";
import { NocturnePrivKey } from "../../crypto";
import { LocalObjectDB } from "../db/local";
import { IncludedNoteStruct } from "../note";
import { NocturneSigner } from "../signer";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(
      new LocalObjectDB({ localMerkle: true }),
      new NocturneSigner(new NocturnePrivKey(1n))
    );
  }

  protected async fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]> {
    return [];
  }

  protected async postStoreNotesFromRefunds(): Promise<void> {}

  protected async fetchJoinSplits(): Promise<JoinSplitEvent[]> {
    return [];
  }

  protected async postApplyJoinSplits(): Promise<void> {}
}
