import { deployContractsWithDummyAdmins } from "../src/deploy";
import { ethers } from "ethers";
import {
  DepositManager__factory,
  Handler__factory,
  SimpleERC20Token__factory,
} from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  CanonAddress,
  DepositRequest,
  StealthAddressTrait,
} from "@nocturne-xyz/sdk";
import { KEYS_TO_WALLETS } from "../src/keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

const ANVIL_URL = "http://127.0.0.1:8545";

// anvil account #5
const SUBTREE_BATCH_FILLER = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";

// anvil account #6
const DEPOSIT_SCREENER = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";

// add MM Flask addresses here
const TEST_ETH_ADDRS = [
  "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
  "0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5",
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
  console.log("deploying contracts with dummy proxy admin...");
  const provider = new ethers.providers.JsonRpcProvider(ANVIL_URL);
  const chainId = BigInt((await provider.getNetwork()).chainId);
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

  const tokenFactory = new SimpleERC20Token__factory(deployerEoa);
  const tokens: SimpleERC20Token[] = [];
  for (let i = 0; i < 2; i++) {
    const token = await tokenFactory.deploy();
    await token.deployed();
    console.log(`Token ${i + 1} deployed at: ${token.address}`);
    tokens.push(token);
  }

  for (const token of tokens) {
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
        const tx = await token.reserveTokens(addr, ethers.utils.parseEther("10.0"));
        await tx.wait(1);
      }
    }

    // Reserve and approve tokens for nocturne addr deployer
    const reserveAmount = ethers.utils.parseEther("1000.0");
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
  const perNoteAmount = ethers.utils.parseEther("10.0");
  for (const encodedAsset of encodedAssets) {
    // Deposit two 100 unit notes for given token
    for (const addr of targetAddrs) {
      console.log(`depositing 1 ${perNoteAmount} note to`, addr, `from ${deployerEoa.address}`);

      const nonce = await depositManager._nonces(deployerEoa.address);
      const depositRequest: DepositRequest = {
        chainId,
        spender: deployerEoa.address,
        encodedAsset,
        value: perNoteAmount.toBigInt(),
        depositAddr: addr,
        nonce: nonce.toBigInt(),
        gasCompensation: BigInt(0),
      };

      const tx = await depositManager
        .connect(deployerEoa)
        .instantiateDeposit(depositRequest);
      await tx.wait(1);
    }
  }

  const tx = await handler.connect(deployerEoa).fillBatchWithZeros();
  await tx.wait(1);
})();
