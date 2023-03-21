import { fetchDepositEvents } from "../src/sync/subgraph/fetch";
import { DepositEventType } from "../src/types";

(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    DepositEventType.Processed,
    0,
    100
  );
  console.log(res);
})();
