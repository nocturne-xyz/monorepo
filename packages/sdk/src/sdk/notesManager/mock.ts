/* eslint-disable */
import { NotesManager, SpendEvent } from ".";
import { FlaxPrivKey } from "../../crypto";
import { LocalFlaxDB } from "../db/local";
import { IncludedNoteStruct } from "../note";
import { FlaxSigner } from "../signer";

export class MockNotesManager extends NotesManager {
  constructor() {
    super(new LocalFlaxDB(), new FlaxSigner(new FlaxPrivKey(1n)));
  }

  protected async fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]> {
    return [];
  }

  protected async postStoreNotesFromRefunds(): Promise<void> {}

  protected async fetchSpends(): Promise<SpendEvent[]> {
    return [];
  }

  protected async postApplySpends(): Promise<void> {}
}
