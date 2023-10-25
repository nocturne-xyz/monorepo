import { ALL_TEST_ADDRESSES } from "../snapshotTestCases";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import { getNewSnapshotFolderPath } from "../utils";

async function execAsync(command: string) {
  return new Promise<void>((resolve, reject) => {
    // spawn child process that inherits stdio from parent so logger has correct output
    const child = spawn(command, { shell: true, stdio: "inherit" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}`));
      }
    });
  });
}
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
  // Convert array to CSV format (each address on a new line)
  const csvContent = ALL_TEST_ADDRESSES.join("\n");

  // Write CSV to file
  await fs.writeFile("snapshotTestCases.csv", csvContent);

  const outputPath = getNewSnapshotFolderPath();

  await execAsync(
    `yarn build && yarn deposit-screener-cli inspect snapshot --input-csv ./snapshotTestCases.csv --output-data ${outputPath}/snapshot.json --delay-ms ${800} --log-level debug`
  );

  process.exit(0);
}

run();
