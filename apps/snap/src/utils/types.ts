import {
  Asset,
  GetNotesOpts,
  SyncOpts,
  OperationRequestWithMetadata,
} from "@nocturne-xyz/core";

interface GetAllBalancesParams {
  opts?: GetNotesOpts;
}
interface GetBalanceForAssetParams {
  opts?: GetNotesOpts;
  asset: Asset;
}
type SignOperationParams = OperationRequestWithMetadata;

interface GetAllBalancesMethod {
  method: "nocturne_getAllBalances";
  params: GetAllBalancesParams;
}

interface GetBalanceForAssetMethod {
  method: "nocturne_getBalanceForAsset";
  params: GetBalanceForAssetParams;
}
interface SyncMethod {
  method: "nocturne_sync";
  params: SyncOpts;
}

interface SignOperationMethod {
  method: "nocturne_signOperation";
  params: SignOperationParams;
}

type MethodsWithNoParams =
  | "nocturne_getRandomizedAddr"
  | "nocturne_getLatestSyncedMerkleIndex"
  | "nocturne_getInFlightOperations"
  | "nocturne_clearDb";

type RpcRequestMethods =
  | GetAllBalancesMethod
  | GetBalanceForAssetMethod
  | SyncMethod
  | SignOperationMethod
  | {
      [K in MethodsWithNoParams]: {
        method: K;
        params: undefined;
      };
    }[MethodsWithNoParams];

export type RpcRequestHandler = (args: {
  origin: string;
  request: RpcRequestMethods;
}) => Promise<unknown>;

export function assertAllMethodsHandled(request: never): never {
  throw new Error("Snap JSON RPC method not handled: " + request);
}

// todo remove after testing
// export const onRpcRequest: RpcRequestHandler = async ({ request }) => {
//   switch (request.method) {
//     case "nocturne_getAllBalances":

//     case "nocturne_getBalanceForAsset":
//     case "nocturne_getRandomizedAddr":
//     case "nocturne_sync":

//     case "nocturne_getLatestSyncedMerkleIndex":
//     case "nocturne_signOperation":
//     case "nocturne_getInFlightOperations":
//     case "nocturne_clearDb":
//       break;
//     default:
//       assertAllMethodsHandled(request);
//   }
// };
