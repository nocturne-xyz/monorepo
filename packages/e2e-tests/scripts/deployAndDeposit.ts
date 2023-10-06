import { deployContractsWithDummyConfig } from "../src/deploy";
import { ethers } from "ethers";
import { CanonAddress, StealthAddressTrait, zip } from "@nocturne-xyz/core";
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
  "0x3babd1532B330CBB57236BCE5356b6C0A9861277", // daniel
  "0x83672560a59b1905C735e7538eAC1b5C6B7258d2", // wayne
];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_NOCTURNE_ADDRS: CanonAddress[] = [
  // luke
  {
    x: 7056522606660870361325034466370949321239193852276800892054991303627972226230n,
    y: 15747131498820334204707818332899890862008805243250008841770517476290170306576n,
  },
  // sebastien
  {
    x: 16050311639850001057016017937715037344457887206622579770053425215727846001874n,
    y: 11561961686801060428789456933088342813622611212723696954741283604434137319859n,
  },
  // daniel
  {
    x: 21810094662991584248543670544455324407472165516530325978277936815581820240557n,
    y: 3135900180088362648756962571679051832113174405893784187728428392187928197296n,
  },
  // wayne
  {
    x: 7314863194427738840825938545358608306075149418734915490341377739242715250545n,
    y: 10581826534373360003481213257490679122605373835137192497580353787501405317835n,
  },
  // sebastien 2
  {
    x: 9763613642235248129680737793714682523014744991733980498787805234761676422867n,
    y: 10750154988310078116071102280671783540437557696952030448726812160586451461915n
  }
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
        .instantiateErc20MultiDeposit(
          token.address,
          [amount],
          StealthAddressTrait.compress(addr)
        );
      await tx.wait(1);
    }
  }

  await provider.send("evm_setIntervalMining", [1000]);

  console.log(
    `deployAndDeposit script finished in ${Date.now() - startTime}ms.`
  );
})();
