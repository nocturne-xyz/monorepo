# RuleSets

To screen deposits, one would create a RuleSet, and add rules to it.

To add rules to the ruleset, one would first create a rule.

A rule takes a **name** (serves as an identifier for easier logging & debugging), a **compliance API to call**, a **threshold** on which the rule should fire, and an **action** to apply, should the threshold be reached.

Check results are either a `Rejection` or a `Delay`. A delay can be specified by any operation (add, multiply, subtract, divide, exponentiate, etc) onto the existing computed delay.

```typescript
Rule {
  name: string;
  call: keyof ApiMap;
  threshold: (data: ApiMap[keyof ApiMap]) => boolean;
  action: Rejection | DelayAction;
}
```

We specify in `call` the API call that we'd like to make, and the returned data type is accessible in our `threshold` function.

Calls are deduped and cached across a RuleSet execution.

## Example

To see a live example, check out [RULESET_V1](./v1/RULESET_V1.ts).

```typescript
const DELAY_50_ALWAYS: RuleParams<"NOOP"> = {
  name: "DELAY_50_ALWAYS",
  call: "NOOP",
  threshold: () => true,
  action: { type: "Delay", operation: "Add", value: 50 },
};

const REJECT_ALWAYS: RuleParams<"NOOP"> = {
  name: "REJECT_ALWAYS",
  call: "NOOP",
  threshold: () => true,
  action: {
    type: "Rejection",
    reason: "If included, this should make the deposit always reject",
  },
};

const DELAY_10000000_NEVER: RuleParams<"NOOP"> = {
  name: "DELAY_10000000_NEVER",
  call: "NOOP",
  threshold: () => false,
  action: { type: "Delay", operation: "Multiply", value: 2 },
};

const RULESET = new RuleSet()
  .add(DELAY_50_ALWAYS)
  .add(REJECT_ALWAYS)
  .add(DELAY_100_NEVER);

// usage:
const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
  spender: "",
  assetAddr: "",
  value: 0n,
};
console.log(RULESET.check(DUMMY_DEPOSIT_REQUEST));
/* Output:
 Screener execution for deposit: { spender: '', assetAddr: '', value: 0n } [
  {
    ruleName: 'DELAY_50_ALWAYS',
    result: { type: 'Delay', operation: 'Add', value: 50 }
  },
  {
    ruleName: 'REJECT_ALWAYS',
    result: {
      type: 'Rejection',
      reason: 'If included, this should make the deposit always reject'
    }
  }
  ]

Result:  {
  type: 'Rejection',
  reason: 'If included, this should make the deposit always reject'
}
 */
```

In this contrived example, we are able to see the execution flow. As you can see, the `DELAY_10000000_NEVER` rule is never executed, as the `REJECT_ALWAYS` rule fires first, and the execution is short-circuited.

## Combining Rules into one Action

We can combine multiple rules into one action via `.combineAndAdd(_)`.

```typescript
const COMBINED_RULE = {
  partials: [
    {
      name: "NEVER_TRUE",
      call: "NOOP",
      threshold: () => false,
    },
    {
      name: "ALWAYS_TRUE",
      call: "NOOP",
      threshold: () => true,
    },
    {
      name: "SOMETIMES_TRUE",
      call: "NOOP",
      threshold: () => Math.random() > 0.5,
    },
  ],
  action: {
    type: "Delay",
    operation: "Add",
    value: 50,
  },
  applyIf: "Any",
};

// usage:
RULESET.combineAndAdd(COMBINED_RULE);
```

This rule will fire if _any_ of the specified partial rules evaluate to true. It can also be specified such that it would only fire if _all_ of the rules were true.
