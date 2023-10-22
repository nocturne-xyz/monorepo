import { cachedFetch } from "@nocturne-xyz/offchain-utils";
import { RequestData } from "../../../../utils";
import IORedis from "ioredis";

const ETHERSCAN_API_BASE_URL = "https://api.etherscan.io/api";

export interface EtherscanErc20TransfersResponse {
  status: string;
  message: string;
  result: EtherscanErc20Transfer[];
}

export interface EtherscanErc20Transfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

export interface EtherscanInternalTxResponse {
  status: string;
  message: string;
  result: EtherscanInternalTx[];
}

export interface EtherscanInternalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: "create" | "call";
  gas: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
}

export async function getEtherscanErc20Transfers(
  tokenAddress: string,
  fromAddress: string,
  startBlock: number,
  endBlock: number,
  redis: IORedis
): Promise<EtherscanErc20Transfer[]> {
  const { requestInfo, requestInit } = getEtherscanTokenTxRequestData(
    tokenAddress,
    fromAddress,
    1,
    100,
    startBlock,
    endBlock
  );
  const res = (await cachedFetch(requestInfo, requestInit, redis).then((res) =>
    res.json()
  )) as EtherscanErc20TransfersResponse;
  return res.result.map((tx) => tx);
}

export async function getEtherscanInternalEthTransfers(
  address: string,
  startBlock: number,
  endBlock: number,
  redis: IORedis
): Promise<EtherscanInternalTx[]> {
  const { requestInfo, requestInit } = getEtherscanInternalTxRequestData(
    address,
    startBlock,
    endBlock,
    1,
    100
  );
  const res = (await cachedFetch(requestInfo, requestInit, redis).then((res) =>
    res.json()
  )) as EtherscanInternalTxResponse;
  return res.result.filter((tx) => Number(tx.value) > 0);
}

function mustGetEtherscanApiKey(): string {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY not set");
  }

  return process.env.ETHERSCAN_API_KEY;
}

function getEtherscanTokenTxRequestData(
  contractAddress: string,
  address: string,
  page = 1,
  offset = 100,
  startBlock: number,
  endBlock: number
): RequestData {
  const apiKey = mustGetEtherscanApiKey();
  const requestInfo = `${ETHERSCAN_API_BASE_URL}?module=account&action=tokentx&contractaddress=${contractAddress}&address=${address}&page=${page}&offset=${offset}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${apiKey}`;
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return { requestInfo, requestInit };
}

function getEtherscanInternalTxRequestData(
  address: string,
  startBlock: number,
  endBlock: number,
  page = 1,
  offset = 100
): RequestData {
  const apiKey = mustGetEtherscanApiKey();
  const requestInfo = `${ETHERSCAN_API_BASE_URL}?module=account&action=txlistinternal&address=${address}&startblock=${startBlock}&endblock=${endBlock}&page=${page}&offset=${offset}&sort=asc&apikey=${apiKey}`;
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return { requestInfo, requestInit };
}
