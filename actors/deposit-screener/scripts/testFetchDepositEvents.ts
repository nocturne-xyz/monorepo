import { DepositEventType } from "../src/sync";
import { fetchDepositEvents } from "../src/sync/subgraph/fetch";
(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    { type: DepositEventType.Processed, fromTotalEntityIndex: 0n }
  );
  console.log(res);
})();
