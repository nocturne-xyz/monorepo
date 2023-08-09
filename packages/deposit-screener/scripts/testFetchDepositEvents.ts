import { fetchDepositEvents, DepositEventType } from "@nocturne-xyz/wallet-sdk";
(async () => {
  const res = await fetchDepositEvents(
    "http://localhost:8000/subgraphs/name/nocturne-test",
    { type: DepositEventType.Processed, fromTotalEntityIndex: 0n }
  );
  console.log(res);
})();
