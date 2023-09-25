import { sleep } from "@nocturne-xyz/core";
import {
  API_CALL_MAP,
  ApiCallNames,
} from "../../src/screening/checks/apiCalls";
import {
  AddressDataSnapshot,
  CachedAddressData,
  TEST_ADDRESSES,
  formDepositInfo,
  saveSnapshot,
} from "../utils";

async function run() {
  const numAddresses = Object.keys(TEST_ADDRESSES).length;
  console.log(
    "Test suite invoked with SNAPSHOT_ADDRESSES=true, running API calls and saving snapshot..."
  );
  console.log(`There are ${numAddresses} addresses to snapshot`);

  let snapshotData: AddressDataSnapshot = {};
  let count = 0;
  for (const address of Object.values(TEST_ADDRESSES)) {
    console.log(
      `Starting API calls for address: ${address} ——— ${
        count + 1
      } of ${numAddresses}`
    );
    const deposit = formDepositInfo(address);
    snapshotData[address] = {};
    for (const [callName, apiCall] of Object.entries(API_CALL_MAP)) {
      if (
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_OVERVIEW.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_RISK_SCORE.name
      ) {
        console.log("Sleeping for 3 seconds to avoid Misttrack rate limit...");
        await sleep(3000);
      }
      const addressData = snapshotData[address] as CachedAddressData;
      console.log(`Calling ${callName} for ${address}...`);
      addressData[callName as ApiCallNames] = await apiCall(deposit);

      console.log(`Successfully called ${callName} for ${address}`);
    }
  }
  console.log("All API calls completed, saving snapshot...");
  saveSnapshot(snapshotData);
  console.log("Snapshot saved successfully");
}

run();
