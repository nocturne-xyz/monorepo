import { DepositRequest } from "@nocturne-xyz/sdk";

export interface ScreeningApi {
  validDepositRequest(deposit: DepositRequest): Promise<boolean>;
}

export { DummyScreeningApi } from "./dummy";
