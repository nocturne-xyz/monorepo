/* tslint:disable */
import { FlaxDB } from ".";
import { IncludedNoteStruct } from "../note";
import { AssetStruct, hashAsset } from "../../commonTypes";

const DUMMY_NOTE: IncludedNoteStruct = {
  owner: {
    h1X: 1n,
    h1Y: 2n,
    h2X: 3n,
    h2Y: 4n,
  },
  nonce: 5n,
  asset: "0x1234",
  id: 1234n,
  value: 100n,
  merkleIndex: 6,
};

export class MockDB extends FlaxDB {
  async getKv(key: string): Promise<string | undefined> {
    return "mockValue";
  }

  async putKv(key: string, value: string): Promise<boolean> {
    return true;
  }

  async removeKv(key: string): Promise<boolean> {
    return true;
  }

  async storeNote(note: IncludedNoteStruct): Promise<boolean> {
    return true;
  }

  async removeNote(note: IncludedNoteStruct): Promise<boolean> {
    return true;
  }

  async getAllNotes(): Promise<Map<string, IncludedNoteStruct[]>> {
    return new Map([
      [
        hashAsset({ address: DUMMY_NOTE.asset, id: DUMMY_NOTE.id }),
        [DUMMY_NOTE],
      ],
    ]);
  }

  async getNotesFor(asset: AssetStruct): Promise<IncludedNoteStruct[]> {
    return [DUMMY_NOTE];
  }

  async clear(): Promise<void> {}

  async close(): Promise<void> {}
}
