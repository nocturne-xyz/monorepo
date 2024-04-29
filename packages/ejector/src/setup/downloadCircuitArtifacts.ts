import path from "path";
import fs from "fs";
import got from "got";
import { ARTIFACTS_DIR } from "../utils";

const CIRCUIT_ARTIFACTS_BASE_URL =
  "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com";
export const CIRCUIT_ARTIFACTS = {
  joinSplit: {
    wasm: "joinsplit/joinsplit.wasm",
    zkey: "joinsplit/joinsplit.zkey",
    vkey: "joinsplit/joinsplitVkey.json",
  },
  subtreeupdate: {
    wasm: "subtreeupdate/subtreeupdate.wasm",
    zkey: "subtreeupdate/subtreeupdate.zkey",
    vkey: "subtreeupdate/subtreeupdateVkey.json",
  },
};

export async function downloadCircuitArtifacts(
  skipSubtreeUpdateCircuit: boolean
): Promise<void> {
  await downloadFile(CIRCUIT_ARTIFACTS.joinSplit.wasm);
  await downloadFile(CIRCUIT_ARTIFACTS.joinSplit.zkey);
  await downloadFile(CIRCUIT_ARTIFACTS.joinSplit.vkey);

  if (!skipSubtreeUpdateCircuit) {
    await downloadFile(CIRCUIT_ARTIFACTS.subtreeupdate.wasm),
      await downloadFile(CIRCUIT_ARTIFACTS.subtreeupdate.vkey),
      await downloadFile(CIRCUIT_ARTIFACTS.subtreeupdate.zkey);
  }
}

async function alreadyDownloadedFile(path: string): Promise<boolean> {
  const lockfile = `${path}.lock`;
  try {
    // if lockfile exists, the download is incomplete, and therefore the file should be re-downloaded
    await fs.promises.access(lockfile);
    await fs.promises.rm(lockfile);
    return false;
  } catch {
    // if it doesn't exist and the file exists, it's already downloaded
    try {
      await fs.promises.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

async function downloadFile(relativePath: string): Promise<void> {
  const outPath = path.join(ARTIFACTS_DIR, relativePath);
  const lockfile = `${outPath}.lock`;
  if (await alreadyDownloadedFile(outPath)) {
    console.log(`File already downloaded: ${outPath} - skipping...`);
    return;
  }

  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(lockfile, "");
  const url = `${CIRCUIT_ARTIFACTS_BASE_URL}/${relativePath}`;
  const prom = new Promise<void>((resolve, reject) => {
    console.log(`Downloading ${url} to ${outPath}`);
    const fileStream = fs.createWriteStream(outPath);

    const downloadStream = got.stream(url);
    downloadStream.on(
      "downloadProgress",
      throttle(({ transferred, total, percent }) => {
        const transeferredMb = (transferred / 1_000_000).toFixed(2);
        const totalMb = (total / 1_000_000).toFixed(2);
        const percentRounded = (percent * 100).toFixed(2);
        process.stdout.write(
          `\rDownloaded ${transeferredMb}/${totalMb} MB (${percentRounded}%)`
        );
      }, 1000)
    );
    downloadStream.pipe(fileStream);

    fileStream.on("finish", () => {
      process.stdout.write(`\rFile downloaded successfully: ${outPath}\n`);
      resolve();
    });

    fileStream.on("error", (err) => {
      reject(new Error(`Error writing file: ${err.message}`));
    });

    downloadStream.on("error", (err: any) => {
      reject(new Error(`Error downloading file: ${err.message}`));
    });
  });

  try {
    await prom;
  } catch {
    await fs.rmSync(outPath);
  }

  await fs.promises.rm(lockfile);
}

function throttle<T>(
  callback: (args: T) => void,
  interval: number
): (args: T) => void {
  let lastExecutionTime = 0;

  return (args: T) => {
    const currentTime = Date.now();

    if (currentTime - lastExecutionTime >= interval) {
      lastExecutionTime = currentTime;
      callback(args);
    }
  };
}
