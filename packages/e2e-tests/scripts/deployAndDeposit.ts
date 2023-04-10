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
import { KEYS_TO_WALLETS } from "../src/keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { deployAndWhitelistERC20 } from "../src/tokens";

const ANVIL_URL = "http://127.0.0.1:8545";

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
  {
    x: 12704419479989462831088949222607517865959716029468493775216288001516871924955n,
    y: 10813016887799300068375838291425202357665005847646472172617457372914028857258n,
  },
  {
    x: 10531276164714485321488172461296879864416112362514696615449591148776974751873n,
    y: 13585423869572436949412525299854957275002229199240796670735390606221054763159n,
  },
  {
    x: 11371413850233756122249719867187341012052383294753337880557780627169186062643n,
    y: 14546776282824561180781715317277618936828659377419026885176146067234890936314n,
  },
];

(async () => {
  const startTime = Date.now();
  const provider = new ethers.providers.JsonRpcProvider(ANVIL_URL);
  console.log("enabling automine...");
  await provider.send("evm_setAutomine", [true]);

  console.log("deploying contracts with dummy proxy admin...");
  const [deployerEoa] = KEYS_TO_WALLETS(provider);

  const { depositManagerProxy, handlerProxy } =
    await deployContractsWithDummyAdmins(deployerEoa, {
      screeners: [DEPOSIT_SCREENER],
      subtreeBatchFillers: [deployerEoa.address, SUBTREE_BATCH_FILLER],
    });
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
    console.log(`Token ${i + 1} deployed at: ${token.address}`);
    tokens.push(token);
    amounts.push(tokenAmount);
  }

  for (const [token, amount] of zip(tokens, amounts)) {
    // airdrop ETH and reserve test tokens (outside nocturne) to each addr in `TEST_ETH_ADDRS`
    for (const addr of TEST_ETH_ADDRS) {
      console.log(`Sending ETH and tokens to ${addr}`);
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

  const tx = await handler.connect(deployerEoa).fillBatchWithZeros();
  await tx.wait(1);

  console.log(
    `deployAndDeposit script finished in ${Date.now() - startTime}ms.`
  );
  console.log("disabling automine...");
  await provider.send("evm_setAutomine", [false]);
  // need to turn interval mining back on, as `setAutomine true` turns off
  // note, we need to set the block time here, but we don't have a good way to get the current block time
  // from anvil, so we just set it to 1 second, which is what the site script sets it to
  await provider.send("evm_setIntervalMining", [1]);
})();
