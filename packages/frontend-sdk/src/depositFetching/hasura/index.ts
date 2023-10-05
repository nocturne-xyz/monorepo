import { DepositHandle, DepositRequestStatusWithMetadata, DisplayDepositRequestWithMetadataAndStatus, OnChainDepositRequestStatus, parseOnChainDepositRequestStatus } from "../../types";
import { DepositAdapter } from "../depositAdapter";
import { DepositStatusResponse, hashDepositRequest } from "@nocturne-xyz/core";
import { Client as UrqlClient, fetchExchange } from "@urql/core";
import { FetchDepositRequestsQuery, FetchDepositStatusQuery } from "./gql/autogenerated/graphql";
import { DepositRequestStatusById, DepositRequestsBySpender } from "./gql/queries";
import { Address } from "@nocturne-xyz/core";
import { flattenDepositRequestStatus, toDepositRequest } from "../../utils";
import retry from "async-retry";
import { hexToBytea, depositRequestResponseToDepositRequestWithMetadata } from "./fetch";

export class HasuraDepositAdapter implements DepositAdapter {
  client: UrqlClient;
  screenerEndpoint: string;

  constructor(graphqlEndpoint: string, screenerEndpoint: string) {
    this.client = new UrqlClient({
      url: graphqlEndpoint,
      exchanges: [fetchExchange],
    });
    this.screenerEndpoint = screenerEndpoint;
  }
  
  async fetchDepositRequestsBySpender(spender: Address): Promise<DepositHandle[]> {
    const spenderBytea = hexToBytea(spender);
    const { data, error } = await this.client.query<FetchDepositRequestsQuery>(DepositRequestsBySpender, { spender: spenderBytea });
    if (error || !data) {
      throw new Error(error?.message ?? "Deposit request query failed");
    }

    return Promise.all(
      data.deposit_request.map((res) => depositRequestResponseToDepositRequestWithMetadata(spender, res))
      .map((depositRequest) => this.makeDepositHandle(depositRequest))
    );
  }

  async makeDepositHandle(requestWithOnChainStatus: DisplayDepositRequestWithMetadataAndStatus): Promise<DepositHandle> {
    const { onChainStatus, ...request } = requestWithOnChainStatus;
    const hash = hashDepositRequest(toDepositRequest(request));

    const getStatus = async () => getDepositRequestStatus(
      this.screenerEndpoint,
      this.client,
      hash,
      onChainStatus
    );

    return {
      depositRequestHash: hash,
      request,
      currentStatus: await getStatus(),
      getStatus,
    };    
  }
}

async function getDepositRequestStatus(
  screenerEndpoint: string,
  client: UrqlClient,
  depositRequestHash: string,
  initialOnChainStatus?: OnChainDepositRequestStatus 
): Promise<DepositRequestStatusWithMetadata> {
  if (!initialOnChainStatus) {
    const { data, error } = await client.query<FetchDepositStatusQuery>(DepositRequestStatusById, { hash: depositRequestHash });
    if (error || !data) {
      throw new Error(error?.message ?? "Deposit request query failed");
    }

    if (data.deposit_request.length === 0) {
      throw new Error("Deposit request not found");
    }
    initialOnChainStatus= parseOnChainDepositRequestStatus(data.deposit_request[0].status);
  }

  const screenerResponse = await retry(
    async () => {
      const res = await fetch(
        `${screenerEndpoint}/status/${depositRequestHash}`
      );
      return (await res.json()) as DepositStatusResponse;
    },
    {
      retries: 5,
    }
  );
  const { status: screenerStatus, estimatedWaitSeconds } = screenerResponse;

  const status = flattenDepositRequestStatus(
    initialOnChainStatus,
    screenerStatus
  );

  return {
    status,
    estimatedWaitSeconds,
  };
}
;