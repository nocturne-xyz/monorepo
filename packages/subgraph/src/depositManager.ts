import { DepositInstantiated } from "../generated/DepositManager/DepositManager";
import { DepositEvent } from "../generated/schema";
import {
  toPaddedHexString,
  getTotalLogIndex,
  getTotalEntityIndex,
} from "./utils";

export function handleDepositInstantiated(event: DepositInstantiated): void {
  const totalLogIndex = getTotalLogIndex(event);
  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);

  const deposit = new DepositEvent(id);

  deposit.type = "Instantiated";
  deposit.spender = event.params.spender;

  deposit.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  deposit.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  deposit.value = event.params.value;
  deposit.depositAddrH1 = event.params.depositAddr.h1;
  deposit.depositAddrH2 = event.params.depositAddr.h2;
  deposit.nonce = event.params.nonce;
  deposit.gasCompensation = event.params.gasCompensation;
  deposit.save();
}
