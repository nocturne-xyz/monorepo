import * as JSON from "bigint-json-serialization";
import fs from "fs";
import path from "path";
import util from "util";
import { ScreeningDepositRequest } from "../src";
import {
  ApiCallNames,
  ApiCallReturnData,
} from "../src/screening/checks/apiCalls";

// Address contexts provided in: notion.so/nocturnelabs/Compliance-Provider-Evaluation-9ffe8bbf698f420498eba9e782e93b6d

export const formDepositInfo = (
  spender: string,
  value = 0n
): ScreeningDepositRequest => {
  return {
    spender,
    assetAddr: "",
    value,
  } as const;
};

export const REJECT_ADDRESSES = {
  ROCKETSWAP: "0x96c0876f573e27636612cf306c9db072d2b13de8",
  ZUNAMI: "0x96c0876f573e27636612cf306c9db072d2b13de8",
  ZUNAMI_2ND_DEGREE: "0xF00d0e11AcCe1eA37658f428d947C3FFFAeaDe70",
  STEADEFI: "0xE10d4a5bd440775226C7e1858f573E379d0aca36",
  EARNING_FARM: "0xee4b3dd20902Fa3539706F25005fa51D3b7bDF1b",
  SUS_TC_USER: "0x5f1237bb7c14d4b4ae0026a186abc9c27a4b1224",
  SWIRLEND: "0x26f6d954c4132fae4efe389b947c8cc4b4ce5ce7",
  AZTEC_4: "0x8C9555D210C9019f952b0cCF57f8E65D542281F2",
  TC_1: "0x86738d21db9a2ccc9747b2e374fd1a500f6eeb50",
  TC_4: "0xa9b4b8108b6df063525aea9bac68b0e03b65e0c5",
  TC_6: "0x698739c0F2e92446f6696578c89308A05F5BA0Fd",
  TC_7: "0xadd7885af8f37df5c965e5d16caf16f807dc79a0",
} as const;

export const APPROVE_ADDRESSES = {
  VITALIK: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  BEIKO: "0x10F5d45854e038071485AC9e402308cF80D2d2fE",
  TC_2: "0xEE6572fD080F791E10B48F789a9C2eF76114bA86",
  TC_3: "0x3f77d1F729B439dA80264622dEACe480153e683D",
  TC_5: "0x5E1B70EA7F694951ebAC269BEb2b3F4f25dD6e6a",
  AZTEC_2: "0xd81A68F256985452E82297b43A465DE4F2a6Fd24",
  AZTEC_1: "0x7c3171A6eabc8fc95077762ACF4B04eE1eAEF465",
  AZTEC_3: "0xa0bE23dB857262c8ff29763930fCD04Cc621FcCA",
} as const;

export const TEST_ADDRESSES = {
  ...REJECT_ADDRESSES,
  ...APPROVE_ADDRESSES,
} as const;

export type ScreeningTestCaseAddresses =
  (typeof TEST_ADDRESSES)[keyof typeof TEST_ADDRESSES];
export type CachedAddressData = Partial<
  Record<ApiCallNames, ApiCallReturnData>
>;
export type AddressDataSnapshot = Partial<
  Record<ScreeningTestCaseAddresses, CachedAddressData>
>;

// saves a snapshot to deposit-screener/test/snapshots/{YYYY-M|MM-D|DD}/snapshot.json
export function saveSnapshot(data: AddressDataSnapshot) {
  const date = new Date();
  const folderPath = path.resolve(
    __dirname,
    "./snapshots",
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  );
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const filePath = path.join(folderPath, "snapshot.json");
  fs.writeFileSync(filePath, JSON.stringify(data));
}

// returns the latest snapshot folder in deposit-screener/test/snapshots, according to dated folder name, if any exist
export async function getLatestSnapshotFolder(
  baseFolder: string
): Promise<string | null> {
  try {
    const readdir = util.promisify(fs.readdir);
    const folderPath = path.resolve(__dirname, baseFolder);
    const files = await readdir(folderPath);

    if (files.length === 0) return null;

    const sortedFolders = files.sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return sortedFolders[0];
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  }
}
