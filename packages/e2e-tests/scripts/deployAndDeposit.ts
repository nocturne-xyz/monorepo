import { deployContractsWithDummyConfig } from "../src/deploy";
import { ethers } from "ethers";
import { CanonAddress, StealthAddressTrait, zip } from "@nocturne-xyz/sdk";
import { KEYS_TO_WALLETS } from "../src/keys";
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

  const [config, { erc20, gasToken }, { depositManager }] =
    await deployContractsWithDummyConfig(deployerEoa, {
      screeners: [DEPOSIT_SCREENER],
      subtreeBatchFillers: [deployerEoa.address, SUBTREE_BATCH_FILLER],
    });

  const tokenAmount = ethers.utils.parseEther("10.0").toBigInt();
  const tokens = [erc20, gasToken];
  const amounts = [tokenAmount, tokenAmount];

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

  // deposit some test tokens to each nocturne address in `TEST_CANONICAL_NOCTURNE_ADDRS`
  const targetAddrs = TEST_CANONICAL_NOCTURNE_ADDRS.map(
    StealthAddressTrait.fromCanonAddress
  );
  for (const [token, amount] of zip(tokens, amounts)) {
    // Deposit two 100 unit notes for given token
    for (const addr of targetAddrs) {
      console.log(
        `depositing 1 ${amount} note to`,
        addr,
        `from ${deployerEoa.address}`
      );
      const tx = await depositManager
        .connect(deployerEoa)
        .instantiateErc20MultiDeposit(token.address, [amount], addr);
      await tx.wait(1);
    }
  }

  await provider.send("evm_setIntervalMining", [1000]);

  console.log(
    `deployAndDeposit script finished in ${Date.now() - startTime}ms.`
  );
})();
