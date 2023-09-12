import { DepositRequest } from "@nocturne-xyz/core";
import { RULESET_V1 } from "./v1/RuleSetV1";

/**
 * USAGE
 */
const DUMMY_DEPOSIT_REQUEST = {} as DepositRequest;
RULESET_V1.check(DUMMY_DEPOSIT_REQUEST)
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
