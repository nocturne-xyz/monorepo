import IORedis from "ioredis";
import {
  API_CALL_MAP,
  ApiCallNames,
  ApiCallReturnData,
  MisttrackData,
  TrmData,
  formatRequestData,
} from "../../../../screening/checks/apiCalls";
import { ScreeningDepositRequest } from "../../../../screening";
import {
  formatCachedFetchCacheKey,
  serializeResponse,
} from "@nocturne-xyz/offchain-utils";
import fs from "fs";
import path from "path";
import { EtherscanErc20Transfer, EtherscanInternalTx } from "./etherscan";
import { TRMTransferRequest } from "./trm";
import { randomUUID } from "crypto";

export type OutputItem = {
  path: string;
  type: "FILE" | "DIRECTORY";
};

export type CachedAddressData = Partial<
  Record<ApiCallNames, ApiCallReturnData>
>;
export type AddressDataSnapshot = Record<string, CachedAddressData>;

export function unixTimestampToISO8601(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toISOString();
}

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

export function etherscanErc20ToTrmTransferRequest(
  transfers: EtherscanErc20Transfer[],
  usdPricePerToken: number
): TRMTransferRequest[] {
  return transfers.map((transfer) => {
    const wholeTokensAmount = Number(
      Number(transfer.value) / 10 ** Number(transfer.tokenDecimal)
    );
    const fiatValue = wholeTokensAmount * usdPricePerToken;

    return {
      accountExternalId: transfer.from,
      asset: transfer.tokenSymbol.toLowerCase(),
      assetAmount: wholeTokensAmount.toString(),
      chain: "ethereum", // TODO: allow more chains
      destinationAddress: transfer.to,
      externalId: randomUUID(),
      fiatCurrency: "USD",
      fiatValue: fiatValue.toString(), // Assuming fiatValue is not directly provided in Etherscan's response
      onchainReference: transfer.hash,
      timestamp: unixTimestampToISO8601(Number(transfer.timeStamp)),
      transferType: "CRYPTO_WITHDRAWAL",
    };
  });
}

export function etherscanInternalEthTransferToTrmTransferRequest(
  internalTxs: EtherscanInternalTx[],
  ethPriceUsd: number
): TRMTransferRequest[] {
  return internalTxs.map((tx) => {
    const wholeAmount = Number(tx.value) / 10 ** 18;
    const fiatValue = wholeAmount * ethPriceUsd;

    return {
      accountExternalId: tx.from,
      asset: "eth",
      assetAmount: wholeAmount.toString(),
      chain: "ethereum",
      destinationAddress: tx.to,
      externalId: tx.hash,
      fiatCurrency: "USD",
      fiatValue: fiatValue.toString(),
      onchainReference: tx.hash,
      timestamp: unixTimestampToISO8601(Number(tx.timeStamp)),
      transferType: "CRYPTO_WITHDRAWAL",
    };
  });
}

export function toTrmResponse(data: TrmData): Response {
  const res = new Response(JSON.stringify([data]));
  res.headers.set("content-type", "application/json");
  return res;
}

export function toMisttrackResponse(data: MisttrackData): Response {
  const res = new Response(
    JSON.stringify({
      success: true, // Assume the data is valid
      data: data,
    })
  );
  res.headers.set("content-type", "application/json");
  return res;
}

export function ensureExists(
  inputPath: string,
  { path: outputPath, type }: OutputItem
): void {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file ${inputPath} does not exist`);
  }

  if (type === "DIRECTORY") {
    // check that the dir where we are going to output to exists using the path library, if not, create it
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // check if we can write to the output directory
    try {
      fs.accessSync(outputPath, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Cannot write to output directory ${outputPath}`);
    }
  } else if (type === "FILE") {
    // check that the directory where we are going to output to exists using the path library, if not, create it
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // check if we can write to the output file
    try {
      fs.accessSync(outputDir, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Cannot write to output file ${outputPath}`);
    }
  } else {
    throw new Error(`Invalid type parameter: ${type}`);
  }
}

export async function getLocalRedis(): Promise<IORedis> {
  const redis = new IORedis({ port: 6380, password: "baka" });
  try {
    // wait for the state to be connected
    let retries = 10;
    while (redis.status !== "ready" && retries-- > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (err) {
    throw new Error(
      `Cannot connect to redis, from the deposit screener folder try 'docker compose up -d redis' if it is not running. ${err}`
    );
  }
  return redis;
}

export async function populateRedisCache(
  snapshotData: AddressDataSnapshot,
  redis: IORedis
): Promise<void> {
  type ApiCallNamesList = Array<keyof typeof API_CALL_MAP>;
  const apiCallNames: ApiCallNamesList = Object.keys(
    API_CALL_MAP
  ) as ApiCallNamesList;

  for (const [address, snapshotForAddress] of Object.entries(snapshotData)) {
    const depositRequest = formDepositInfo(address);
    for (const apiCallName of apiCallNames) {
      const apiCallReturnData = snapshotForAddress[apiCallName];
      if (!apiCallReturnData || apiCallName == "IDENTITY") {
        console.log(
          `No snapshot data found for address=${address} and apiCallName=${apiCallName}`
        );
        continue;
      }

      let response: Response;
      if (apiCallName == "TRM_SCREENING_ADDRESSES") {
        response = toTrmResponse(apiCallReturnData as TrmData);
      } else if (
        apiCallName == "MISTTRACK_ADDRESS_LABELS" ||
        apiCallName == "MISTTRACK_ADDRESS_RISK_SCORE" ||
        apiCallName == "MISTTRACK_ADDRESS_OVERVIEW"
      ) {
        response = toMisttrackResponse(apiCallReturnData as MisttrackData);
      } else {
        throw new Error(`unknown apiCallName: ${apiCallName}`);
      }

      const { requestInfo, requestInit } = formatRequestData(
        apiCallName,
        depositRequest
      );
      const cacheKey = formatCachedFetchCacheKey(requestInfo, requestInit);

      const serializedResponse = await serializeResponse(response);

      console.log(`Setting cache entry for address ${address}`);
      console.log(`cacheKey=${cacheKey}`);
      console.log(`apiCallReturnData=${serializedResponse}`);
      await redis.set(cacheKey, serializedResponse);
    }
  }
}
