/* eslint-disable */
import { NotesManager, SpendEvent } from ".";
import { NocturnePrivKey } from "../../crypto";
import { LocalObjectDB } from "../db/local";
import { IncludedNote } from "../note";
import { NocturneSigner } from "../signer";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(
      new LocalObjectDB({ localMerkle: true }),
      new NocturneSigner(new NocturnePrivKey(1n))
    );
  }

  protected async fetchNotesFromRefunds(): Promise<IncludedNote[]> {
    return [];
  }

  protected async postStoreNotesFromRefunds(): Promise<void> {}

  protected async fetchSpends(): Promise<SpendEvent[]> {
    return [];
  }

  protected async postApplySpends(): Promise<void> {}
}
