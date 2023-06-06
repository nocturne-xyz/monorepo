import { fetchDepositEvents, DepositEventType } from "@nocturne-xyz/sdk";
(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    { type: DepositEventType.Processed, fromBlock: 0, toBlock: 100 }
  );
  console.log(res);
})();
