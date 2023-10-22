import { RequestData } from "../../../../utils";

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
  endBlock: number
): Promise<EtherscanErc20TransfersResponse> {
  const { requestInfo, requestInit } = getEtherscanTokenTxRequestData(
    tokenAddress,
    fromAddress,
    1,
    100,
    startBlock,
    endBlock
  );
  return fetch(requestInfo, requestInit).then((res) => res.json());
}

export async function getEtherscanInternalEthTransfers(
  address: string,
  startBlock: number,
  endBlock: number
): Promise<EtherscanInternalTxResponse> {
  const { requestInfo, requestInit } = getEtherscanInternalTxRequestData(
    address,
    startBlock,
    endBlock,
    1,
    100
  );
  return fetch(requestInfo, requestInit).then((res) => res.json());
}

function mustGetEtherscanApiKey(): string {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY not set");
  }

  return process.env.ETHERSCAN_API_KEY;
}

// Helper function for ERC-20 token transfers
function getEtherscanTokenTxRequestData(
  contractAddress: string,
  address: string,
  page: number = 1,
  offset: number = 100,
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

// Helper function for internal transactions
function getEtherscanInternalTxRequestData(
  address: string,
  startBlock: number,
  endBlock: number,
  page: number = 1,
  offset: number = 100
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
