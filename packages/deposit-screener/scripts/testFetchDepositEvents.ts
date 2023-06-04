import { fetchDepositEvents, DepositEventType } from "@nocturne-xyz/sdk";
(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    DepositEventType.Processed,
    0,
    100
  );
  console.log(res);
})();
