import { DepositInstantiated } from "../generated/DepositManager/DepositManager";
import { DepositEvent } from "../generated/schema";
import { getId, getTotalLogIndex } from "./utils";

export function handleDepositInstantiated(event: DepositInstantiated): void {
  const totalLogIndex = getTotalLogIndex(event);
  const id = getId(totalLogIndex);

  const deposit = new DepositEvent(id);

  deposit.type = "Instantiated";
  deposit.chainId = event.params.chainId;
  deposit.spender = event.params.spender;

  deposit.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  deposit.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  deposit.value = event.params.value;
  deposit.depositAddrH1X = event.params.depositAddr.h1X;
  deposit.depositAddrH1Y = event.params.depositAddr.h1Y;
  deposit.depositAddrH2X = event.params.depositAddr.h2X;
  deposit.depositAddrH2Y = event.params.depositAddr.h2Y;
  deposit.nonce = event.params.nonce;
  deposit.gasCompensation = event.params.gasCompensation;
  deposit.save();
}
