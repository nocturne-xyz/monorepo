import { ethers } from "ethers";
import { UnprovenOperation, UnprovenSpendTransaction } from "./types";

const SIXTEEN = 16;
const THIRTY_TWO = 32;

// TODO: hex zero pad

function bigIntToPaddedBytesLike(n: bigint): string {
  return ethers.utils.hexZeroPad("0x" + n.toString(SIXTEEN), THIRTY_TWO);
}

export function hashOperation(op: UnprovenOperation): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload = [] as any;
  for (let i = 0; i < op.actions.length; i++) {
    const action = op.actions[i];
    payload = ethers.utils.concat([
      payload,
      action.contractAddress,
      ethers.utils.keccak256(action.encodedFunction),
    ]);
  }

  const spendTokensHash = ethers.utils.keccak256(
    ethers.utils.concat([...op.tokens.spendTokens])
  );
  const refundTokensHash = ethers.utils.keccak256(
    ethers.utils.concat([...op.tokens.refundTokens])
  );

  payload = ethers.utils.concat([
    payload,
    bigIntToPaddedBytesLike(op.refundAddr.h1X),
    bigIntToPaddedBytesLike(op.refundAddr.h1Y),
    bigIntToPaddedBytesLike(op.refundAddr.h2X),
    bigIntToPaddedBytesLike(op.refundAddr.h2Y),
    spendTokensHash,
    refundTokensHash,
    bigIntToPaddedBytesLike(op.gasLimit),
  ]);

  return ethers.utils.keccak256(payload);
}

export function hashSpend(spend: UnprovenSpendTransaction): string {
  const payload = ethers.utils.concat([
    bigIntToPaddedBytesLike(spend.commitmentTreeRoot),
    bigIntToPaddedBytesLike(spend.nullifier),
    bigIntToPaddedBytesLike(spend.newNoteCommitment),
    bigIntToPaddedBytesLike(spend.value),
    spend.asset,
    bigIntToPaddedBytesLike(spend.id),
  ]);

  return ethers.utils.keccak256(payload);
}

export function calculateOperationDigest(
  operationHash: string,
  spendHash: string
): string {
  return ethers.utils.keccak256(
    ethers.utils.concat([operationHash, spendHash])
  );
}
