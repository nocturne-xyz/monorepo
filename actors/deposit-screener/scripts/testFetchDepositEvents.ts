import { fetchDepositEvents, DepositEventType } from "@nocturne-xyz/core";
(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    { type: DepositEventType.Processed, fromTotalEntityIndex: 0n }
  );
  console.log(res);
})();
