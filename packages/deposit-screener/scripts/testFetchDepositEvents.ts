import {
  fetchDepositEvents,
  DepositEventType,
} from "../src/sync/subgraph/fetch";

(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    DepositEventType.Processed,
    0,
    100
  );
  console.log(res);
})();
