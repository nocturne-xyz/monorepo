import path from "path";
import { AddressDataSnapshot } from "../src/cli/commands/inspect/helpers";
import fs from "fs";
import { promisify } from "util";
import { ScreeningDepositRequest } from "../src";

export function getNewSnapshotFolderPath(): string {
  const date = new Date();
  const folderPath = path.resolve(
    __dirname,
    "./snapshots",
    date.toISOString().substring(0, 10)
  );
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  return folderPath;
}

// saves a snapshot to deposit-screener/test/snapshots/{YYYY-M|MM-D|DD}/snapshot.json
export function saveSnapshot(data: AddressDataSnapshot) {
  const folderPath = getNewSnapshotFolderPath();
  const filePath = path.join(folderPath, "snapshot.json");
  fs.writeFileSync(filePath, JSON.stringify(data));
}

// returns the latest snapshot folder in deposit-screener/test/snapshots, according to dated folder name, if any exist
export async function getLatestSnapshotFolder(
  baseDir: string
): Promise<string | null> {
  try {
    const readdir = promisify(fs.readdir);
    const folderPath = path.resolve(__dirname, baseDir);
    const files = await readdir(folderPath);

    if (files.length === 0) return null;

    const sortedFolders = files.sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return `${baseDir}/${sortedFolders[0]}`;
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  }
}

export const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
  spender: "",
  assetAddr: "",
  value: 0n,
} as const;
