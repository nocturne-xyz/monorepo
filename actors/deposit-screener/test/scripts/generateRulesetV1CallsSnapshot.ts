import { sleep } from "@nocturne-xyz/core";
import {
  API_CALL_MAP,
  ApiCallNames,
} from "../../src/screening/checks/apiCalls";
import {
  AddressDataSnapshot,
  CachedAddressData,
  formDepositInfo,
  saveSnapshot,
  ALL_TEST_ADDRESSES,
} from "../utils";

/**
 * This script is used to generate a snapshot of the API calls for the test addresses.
 *
 * Snapshots go in the `./actors/deposit-screener/test/snapshots` directory.
 * They're in folders sorted by date.
 *
 * To generate a new snapshot
 * - `yarn install` if necessary
 * - `yarn dev:env` copies the .env.dev to .env
 * - update the .env file with the api keys MISTTRACK_API_KEY and TRM_API_KEY
 * - From the `./actors/deposit-screener` directory run: `yarn test:generate-snapshot`
 * - Optional - not sure what the policy should be here, but we could delete old snapshots and commit that. They're
 *   still in git history if we need them.
 */
async function run() {
  const numAddresses = ALL_TEST_ADDRESSES.length;
  console.log(`There are ${numAddresses} addresses to snapshot`);

  if (!process.env.MISTTRACK_API_KEY) {
    throw new Error("MISTTRACK_API_KEY not set");
  }
  if (!process.env.TRM_API_KEY) {
    throw new Error("TRM_API_KEY not set");
  }
  let snapshotData: AddressDataSnapshot = {};
  let count = 0;
  for (const address of ALL_TEST_ADDRESSES) {
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
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_RISK_SCORE.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_LABELS.name
      ) {
        console.log("Sleeping for 5 seconds to avoid Misttrack rate limit...");
        await sleep(5000);
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
