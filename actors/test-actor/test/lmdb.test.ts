import "mocha";
import { testKvStoreImpl } from "@nocturne-xyz/core/test/utils";
import { LMDBKVStore } from "../src/lmdb";
import fs from "fs";

describe("LMDBKVStore", testKvStoreImpl(new LMDBKVStore({ path: "./test-db" }), async (kv) => {
  fs.rmSync("./test-db", { recursive: true, force: true });
  await kv.close();
}));
