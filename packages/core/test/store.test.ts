import { InMemoryKVStore } from "../src";
import { testDumpableKvStoreImpl } from "./utils";

describe("InMemoryKVStore", testDumpableKvStoreImpl(new InMemoryKVStore()));
