import { Wallet } from "@nocturne-xyz/contracts";
import { Operation, ProvenOperation, OperationResult } from "./primitives";
import { SolidityProof } from "./proof";

export class OpSimulator {
  private readonly wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  async simulateOperation(op: Operation): Promise<OperationResult> {
    // We need to do staticCall, which fails if wallet is connected to a signer
    // https://github.com/ethers-io/ethers.js/discussions/3327#discussioncomment-3539505
    // Switching to a regular provider underlying the signer
    let wallet = this.wallet;
    if (this.wallet.signer) {
      wallet = this.wallet.connect(wallet.provider);
    }

    // Fill-in the some fake proof
    const provenOp = this.fakeProvenOperation(op);

    // Set gasPrice to 0 so that gas payment does not interfere with amount of
    // assets unwrapped pre gas estimation
    // ?: does this actually do anything if it's after `fakeProvenOperation` dummy provenOp?
    op.gasPrice = 0n;

    // Set dummy parameters which should not affect operation simulation
    const verificationGasForOp = 0n;
    const bundler = wallet.address;

    const result = await wallet.callStatic.processOperation(
      provenOp,
      verificationGasForOp,
      bundler,
      {
        from: wallet.address,
      }
    );
    const {
      opProcessed,
      failureReason,
      callSuccesses,
      callResults,
      verificationGas,
      executionGas,
      numRefunds,
    } = result;

    return {
      opProcessed,
      failureReason,
      callSuccesses,
      callResults,
      verificationGas: verificationGas.toBigInt(),
      executionGas: executionGas.toBigInt(),
      numRefunds: numRefunds.toBigInt(),
    };
  }

  private fakeProvenOperation(op: Operation): ProvenOperation {
    const provenJoinSplits = op.joinSplits.map((joinSplit) => {
      return {
        commitmentTreeRoot: joinSplit.commitmentTreeRoot,
        nullifierA: joinSplit.nullifierA,
        nullifierB: joinSplit.nullifierB,
        newNoteACommitment: joinSplit.newNoteACommitment,
        newNoteBCommitment: joinSplit.newNoteBCommitment,
        encodedAsset: joinSplit.encodedAsset,
        publicSpend: joinSplit.publicSpend,
        newNoteAEncrypted: joinSplit.newNoteAEncrypted,
        newNoteBEncrypted: joinSplit.newNoteBEncrypted,
        proof: [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as SolidityProof,
      };
    });
    return {
      refundAddr: op.refundAddr,
      encodedRefundAssets: op.encodedRefundAssets,
      actions: op.actions,
      executionGasLimit: op.executionGasLimit,
      maxNumRefunds: op.maxNumRefunds,
      gasPrice: op.gasPrice,
      joinSplits: provenJoinSplits,
    };
  }
}
