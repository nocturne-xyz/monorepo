import { DepositRequest } from "@nocturne-xyz/sdk";
import { ScreeningApi } from ".";

export class DummyScreeningApi implements ScreeningApi {
  async validDepositRequest(deposit: DepositRequest): Promise<boolean> {
    return true;
  }
}
