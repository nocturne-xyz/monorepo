import "mocha";
import "fake-indexeddb/auto";
import { IdbKvStore } from "../src";
import { testKvStoreImpl } from "@nocturne-xyz/core/test/utils";

describe("IdbKvStore", testKvStoreImpl(new IdbKvStore("test-db")));
