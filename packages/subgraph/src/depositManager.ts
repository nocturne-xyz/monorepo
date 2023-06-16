import {
  DepositCompleted,
  DepositInstantiated,
  DepositRetrieved,
} from "../generated/DepositManager/DepositManager";
import { DepositEvent, DepositRequest } from "../generated/schema";
import {
  toPaddedHexString,
  getTotalLogIndex,
  getTotalEntityIndex,
} from "./utils";

export function handleDepositInstantiated(event: DepositInstantiated): void {
  const totalLogIndex = getTotalLogIndex(event);
  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);

  // make DepositEvent entity (for syncing SDK and offchain actors )

  const depositEvent = new DepositEvent(id);
  depositEvent.type = "Instantiated";
  depositEvent.spender = event.params.spender;
  depositEvent.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  depositEvent.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  depositEvent.value = event.params.value;
  depositEvent.depositAddrH1 = event.params.depositAddr.h1;
  depositEvent.depositAddrH2 = event.params.depositAddr.h2;
  depositEvent.nonce = event.params.nonce;
  depositEvent.gasCompensation = event.params.gasCompensation;
  depositEvent.save();

  // make DepositRequest entity

  const depositRequest = new DepositRequest(id);
  depositRequest.status = "Pending";
  depositRequest.spender = event.params.spender;
  depositRequest.encodedAssetAddr = event.params.encodedAsset.encodedAssetAddr;
  depositRequest.encodedAssetId = event.params.encodedAsset.encodedAssetId;
  depositRequest.value = event.params.value;
  depositRequest.depositAddrH1 = event.params.depositAddr.h1;
  depositRequest.depositAddrH2 = event.params.depositAddr.h2;
  depositRequest.nonce = event.params.nonce;
  depositRequest.gasCompensation = event.params.gasCompensation;
  depositRequest.save();
}

export function handleDepositCompleted(event: DepositCompleted): void {
  const totalLogIndex = getTotalLogIndex(event);
  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);

  const depositEvent = DepositEvent.load(id);
  if (depositEvent === null) {
    // should never happen
    return;
  }

  depositEvent.type = "Completed";
  depositEvent.save();
}

export function handleDepositRetrieved(event: DepositRetrieved): void {
  const totalLogIndex = getTotalLogIndex(event);
  const idx = getTotalEntityIndex(totalLogIndex, 0);
  const id = toPaddedHexString(idx);

  const depositEvent = DepositEvent.load(id);
  if (depositEvent === null) {
    // should never happen
    return;
  }

  depositEvent.type = "Retrieved";
  depositEvent.save();
}
