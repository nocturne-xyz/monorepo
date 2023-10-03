export * from "./depositAdapter";


import { SubgraphSDKSyncAdapter } from "@nocturne-xyz/core";
import { SubgraphDepositAdapter } from "./subgraph";
import { HasuraDepositAdapter, HasuraSdkSyncAdapter } from "./hasura";

export const SubgraphAdapters = {
  SubgraphDepositAdapter,
  SubgraphSDKSyncAdapter,
};

export const HasuraAdapters = {
  HasuraDepositAdapter,
  HasuraSdkSyncAdapter,
};
