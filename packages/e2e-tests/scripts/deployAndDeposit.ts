import { deployContractsWithDummyAdmins } from "../src/deploy";
import { ethers } from "ethers";
import {
  DepositManager__factory,
  Handler__factory,
} from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  CanonAddress,
  StealthAddressTrait,
  zip,
} from "@nocturne-xyz/sdk";
import { NocturneConfig } from "@nocturne-xyz/config";
import { KEYS_TO_WALLETS } from "../src/keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { deployAndWhitelistERC20 } from "../src/tokens";
import fs from "fs";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ANVIL_URL = "http://127.0.0.1:8545";

const ROOT_DIR = findWorkspaceRoot()!;
const CONFIG_PATH = `${ROOT_DIR}/packages/config/configs/localhost.json`;

// anvil account #5
const SUBTREE_BATCH_FILLER = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";

// anvil account #6
const DEPOSIT_SCREENER = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";

// add MM Flask addresses here
const TEST_ETH_ADDRS = [
  "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
  "0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5",
  "0x7DD91d84257596fC1dF6ee26e428a3AF86443EC6",
];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_NOCTURNE_ADDRS: CanonAddress[] = [
  // luke
  {
    x: 10142086077893486181754172705121012824519743084895847195556991208649326069031n,
    y: 8193080910598498103381811317346023892678961233898095959711997273954450549100n,
  },
  // sebastien
  {
    x: 1441066160553778219808661378611760479884464923094970807507826046172487135388n,
    y: 2780714365822323562859897945726675737150114817291312997511941355689684182163n,
  },
  // daniel
  {
    x: 19799258522113603135363272915180271151480541087034599231341141852585629320603n,
    y: 8749027578620186155044097344182564177881015597171155166755502239772218892911n,
  },
];

(async () => {
  const startTime = Date.now();
  const provider = new ethers.providers.JsonRpcProvider(ANVIL_URL);
  console.log("enabling automine...");
  await provider.send("evm_setAutomine", [true]);

  console.log("deploying contracts with dummy proxy admin...");
  const [deployerEoa] = KEYS_TO_WALLETS(provider);

  const contractDeployment = await deployContractsWithDummyAdmins(deployerEoa, {
    screeners: [DEPOSIT_SCREENER],
    subtreeBatchFillers: [deployerEoa.address, SUBTREE_BATCH_FILLER],
  });

  const { handlerProxy, depositManagerProxy } = contractDeployment;
  const handler = Handler__factory.connect(handlerProxy.proxy, deployerEoa);
  const depositManager = DepositManager__factory.connect(
    depositManagerProxy.proxy,
    deployerEoa
  );

  const tokenAmount = ethers.utils.parseEther("10.0").toBigInt();
  const tokens: SimpleERC20Token[] = [];
  const amounts: bigint[] = [];
  for (let i = 0; i < 2; i++) {
    const [token] = await deployAndWhitelistERC20(deployerEoa, handler);
    console.log(`ERC20 token ${i + 1} deployed at: ${token.address}`);
    tokens.push(token);
    amounts.push(tokenAmount);
  }

  // both tokens are gas assets
  const gasAssets = new Map(
    tokens.map((token, i) => [`TOKEN-${i}`, token.address])
  );
  // no rate limits
  const rateLimits = new Map();
  const config = new NocturneConfig(contractDeployment, gasAssets, rateLimits);
  fs.writeFileSync(CONFIG_PATH, config.toString());

  for (const [token, amount] of zip(tokens, amounts)) {
    // airdrop ETH and reserve test tokens (outside nocturne) to each addr in `TEST_ETH_ADDRS`
    for (const addr of TEST_ETH_ADDRS) {
      console.log(`sending ETH and tokens to ${addr}`);
      {
        const tx = await deployerEoa.sendTransaction({
          to: addr,
          value: ethers.utils.parseEther("10.0"),
        });
        await tx.wait(1);
      }
      {
        const tx = await token.reserveTokens(addr, amount);
        await tx.wait(1);
      }
    }

    // Reserve and approve tokens for nocturne addr deployer
    const reserveAmount = amount * 100n;
    {
      const tx = await token
        .connect(deployerEoa)
        .reserveTokens(deployerEoa.address, reserveAmount);
      await tx.wait(1);
    }
    {
      const tx = await token
        .connect(deployerEoa)
        .approve(depositManager.address, reserveAmount);
      await tx.wait(1);
    }
  }

  const encodedAssets = tokens
    .map((token) => ({
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    }))
    .map(AssetTrait.encode);

  // deposit some test tokens to each nocturne address in `TEST_CANONICAL_NOCTURNE_ADDRS`
  const targetAddrs = TEST_CANONICAL_NOCTURNE_ADDRS.map(
    StealthAddressTrait.fromCanonAddress
  );
  for (const [encodedAsset, amount] of zip(encodedAssets, amounts)) {
    // Deposit two 100 unit notes for given token
    for (const addr of targetAddrs) {
      console.log(
        `depositing 1 ${amount} note to`,
        addr,
        `from ${deployerEoa.address}`
      );
      const tx = await depositManager
        .connect(deployerEoa)
        .instantiateDeposit(encodedAsset, amount, addr);
      await tx.wait(1);
    }
  }

  await provider.send("evm_setIntervalMining", [1000]);

  console.log(
    `deployAndDeposit script finished in ${Date.now() - startTime}ms.`
  );
})();
