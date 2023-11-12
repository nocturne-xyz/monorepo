import { ScreeningDepositRequest } from "../src";
import {
  CombinedRulesParams,
  RuleParams,
  RuleSet,
} from "../src/screening/checks/RuleSet";
import IORedis from "ioredis";
import { expect } from "chai";
import RedisMemoryServer from "redis-memory-server";

const DELAY_50_ALWAYS: RuleParams<"IDENTITY"> = {
  name: "DELAY_50_ALWAYS",
  call: "IDENTITY",
  threshold: () => true,
  action: { type: "Delay", operation: "Add", valueSeconds: 50 },
};

const REJECT_ALWAYS: RuleParams<"IDENTITY"> = {
  name: "REJECT_ALWAYS",
  call: "IDENTITY",
  threshold: () => true,
  action: {
    type: "Rejection",
    reason: "If included, this should make the deposit always reject",
  },
};

const DELAY_10000000_NEVER: RuleParams<"IDENTITY"> = {
  name: "DELAY_10000000_NEVER",
  call: "IDENTITY",
  threshold: () => false,
  action: { type: "Delay", operation: "Add", valueSeconds: 10000000 },
};

const COMBINED_RULE_ANY: CombinedRulesParams<
  ["IDENTITY", "IDENTITY", "IDENTITY"]
> = {
  partialRules: [
    {
      name: "NEVER_TRUE",
      call: "IDENTITY",
      threshold: () => false,
    },
    {
      name: "ALWAYS_TRUE",
      call: "IDENTITY",
      threshold: () => true,
    },
    {
      name: "SOMETIMES_TRUE",
      call: "IDENTITY",
      threshold: () => Math.random() > 0.5,
    },
  ],
  action: {
    type: "Delay",
    operation: "Add",
    valueSeconds: 50,
  },
  applyIf: "Any",
} as const;

const COMBINED_RULE_ALL = {
  ...COMBINED_RULE_ANY,
  applyIf: "All",
} as const;

const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
  spender: "",
  assetAddr: "",
  value: 0n,
} as const;

describe("RuleSet", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);
  });

  it("should return a delay of 300 seconds", async () => {
    const DUMMY_RULESET = new RuleSet({ baseDelaySeconds: 0 }, redis)
      .add(DELAY_50_ALWAYS)
      .add(DELAY_10000000_NEVER);
    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 50,
    });
  });

  it("should return a rejection", async () => {
    const DUMMY_RULESET = new RuleSet({ baseDelaySeconds: 0 }, redis)
      .add(DELAY_50_ALWAYS)
      .add(REJECT_ALWAYS)
      .add(DELAY_10000000_NEVER);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal(REJECT_ALWAYS.action);
  });

  it("should take a combined rule requiring *any* to be true, and return a delay of 50", async () => {
    const DUMMY_RULESET = new RuleSet(
      { baseDelaySeconds: 0 },
      redis
    ).combineAndAdd(COMBINED_RULE_ANY);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 50,
    });
  });

  it("should take a combined rule requiring *all* to be true, and not apply the action", async () => {
    console.log("COMBINED_RULE_ALL", COMBINED_RULE_ALL);
    const DUMMY_RULESET = new RuleSet(
      { baseDelaySeconds: 0 },
      redis
    ).combineAndAdd(COMBINED_RULE_ALL);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 0,
    });
  });
});
