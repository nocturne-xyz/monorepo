import {
  MockEthToTokenConverter,
  newOpRequestBuilder,
  NocturneClient,
  NocturneDB,
  proveOperation,
  signOperation,
} from "@nocturne-xyz/client";
import {
  AssetType,
  InMemoryKVStore,
  JoinSplitProver,
  NocturneSigner,
  SparseMerkleProver,
  thunk,
  Thunk,
  VerifyingKey,
} from "@nocturne-xyz/core";
import { SubgraphSDKSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import { ARTIFACTS_DIR, SUBGRAPH_URL } from "./utils";
import { ethers } from "ethers";
import { getEnvVars } from "./env";
import { MockOpTracker } from "@nocturne-xyz/client/dist/src/OpTracker";
import { Erc20Plugin } from "@nocturne-xyz/op-request-plugins";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import path from "path";
import fs from "fs";
import { CIRCUIT_ARTIFACTS } from "./setup/downloadCircuitArtifacts";
import { Teller, Teller__factory } from "@nocturne-xyz/contracts";
import { loadNocturneConfig, NocturneConfig } from "@nocturne-xyz/config";

export const GAS_MULTIPLIER = 0;

export class WithdrawalClient {
  provider: ethers.providers.JsonRpcProvider;
  eoa: ethers.Wallet;
  signer: NocturneSigner;
  client: NocturneClient;
  syncAdapter: SubgraphSDKSyncAdapter;
  db: NocturneDB;
  config: NocturneConfig;
  teller: Teller;

  joinSplitProver: Thunk<JoinSplitProver>;

  constructor(networkNameOrConfigPath = "mainnet") {
    const { RPC_URL, SPEND_PRIVATE_KEY } = getEnvVars();
    this.db = new NocturneDB(new InMemoryKVStore());
    this.syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_URL);
    this.signer = new NocturneSigner(ethers.utils.arrayify(SPEND_PRIVATE_KEY));
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    this.eoa = new ethers.Wallet(SPEND_PRIVATE_KEY, this.provider);
    this.client = new NocturneClient(
      this.signer,
      this.provider,
      "mainnet",
      new SparseMerkleProver(this.db.kv),
      this.db,
      this.syncAdapter,
      new MockEthToTokenConverter(),
      new MockOpTracker()
    );

    this.config = loadNocturneConfig(networkNameOrConfigPath);

    this.teller = Teller__factory.connect(
      this.config.contracts.tellerProxy.proxy,
      this.eoa
    );

    this.joinSplitProver = thunk(async () => {
      const vkey = await fs.promises.readFile(
        path.join(ARTIFACTS_DIR, CIRCUIT_ARTIFACTS.joinSplit.vkey),
        { encoding: "utf-8" }
      );
      return new WasmJoinSplitProver(
        path.join(ARTIFACTS_DIR, CIRCUIT_ARTIFACTS.joinSplit.wasm),
        path.join(ARTIFACTS_DIR, CIRCUIT_ARTIFACTS.joinSplit.zkey),
        JSON.parse(vkey) as VerifyingKey
      );
    });
  }

  async sync(): Promise<void> {
    await this.client.sync();
  }

  async withdrawEverything(): Promise<void> {
    const balances = await this.client.getAllAssetBalances();
    const builder = newOpRequestBuilder(this.provider, this.config.chainId).use(
      Erc20Plugin
    );
    console.log(
      `Initializing batch-withdrawal to recipient: ${this.eoa.address}`
    );
    for (const { asset, balance } of balances) {
      // this should never happen since we only care about ERC20 assets
      if (asset.assetType !== AssetType.ERC20) {
        console.log("skipping non-ERC20 asset");
        continue;
      }

      // TODO: use ticker instead of address
      console.log(
        `\tadding withdrawal for asset with contract address ${asset.assetAddr}...`
      );
      if (balance > 0n) {
        builder.erc20Transfer(asset.assetAddr, this.eoa.address, balance);
      }
    }

    const opRequest = await builder.build();
    const preSignOp = await this.client.prepareOperation(
      opRequest.request,
      GAS_MULTIPLIER
    );
    const signedOp = await signOperation(this.signer, preSignOp);
    const provenOp = await proveOperation(
      await this.joinSplitProver(),
      signedOp
    );

    console.log("Submitting batch-withdrawal transaction...");
    const tx = await this.teller.processBundle({
      operations: [provenOp],
    });
    console.log(`Transaction submitted with hash: ${tx.hash}`);
    console.log("Waiting 3 confirmations...");
    await tx.wait(3);
    console.log("Withdrawal complete!");
  }
}
