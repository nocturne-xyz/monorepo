import { deployContractsWithDummyAdmin } from "../src/deploy";
import { ethers } from "ethers";
import { SimpleERC20Token__factory, Vault__factory, Wallet__factory } from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  CanonAddress,
  DepositRequest,
  StealthAddressTrait,
} from "@nocturne-xyz/sdk";
import {
  EIP712Domain,
  signDepositRequest,
} from "@nocturne-xyz/deposit-screener";
import { KEYS_TO_WALLETS } from "../src/keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { NocturneDeployer } from "@nocturne-xyz/deploy";

const HH_URL = "http://localhost:8545";

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
  console.log("deploying contracts with dummy proxy admin...")
  const provider = new ethers.providers.JsonRpcProvider(HH_URL);
  const chainId = BigInt((await provider.getNetwork()).chainId);
  const [deployer] = KEYS_TO_WALLETS(provider);
  const { depositManager, wallet } = await setupNocturne({
    connectedSigner: deployer,
    screeners: TEST_ETH_ADDRS.concat(deployer.address), // TODO: remove this once we have real deposit-screener
  });
  const tokenFactory = new SimpleERC20Token__factory(deployer);
  const tokens: SimpleERC20Token[] = [];
  for (let i = 0; i < 2; i++) {
    const token = await tokenFactory.deploy();
    await token.deployed();
    console.log(`Token ${i + 1} deployed at: ${token.address}`);
    tokens.push(token);
  }

  // airdrop ETH and reserve test tokens (outside nocturne) to each addr in `TEST_ETH_ADDRS`
  for (const token of tokens) {
    for (const addr of TEST_ETH_ADDRS) {
      console.log(`Sending ETH and tokens to ${addr}`);
      await deployerEoa.sendTransaction({
        to: addr,
        value: ethers.utils.parseEther("10.0"),
      });
      await token.reserveTokens(addr, ethers.utils.parseEther("10.0"));
    }

    // Reserve and approve tokens for nocturne addr deployer
    const reserveAmount = ethers.utils.parseEther("100.0");
    await token
      .connect(deployer)
      .reserveTokens(deployer.address, reserveAmount);
    await token
      .connect(deployer)
      .approve(depositManager.address, reserveAmount);
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
      console.log("depositing 1 100 token note to", addr);

      const nonce = await depositManager._nonces(deployer.address);
      const depositRequest: DepositRequest = {
        chainId,
        spender: deployer.address,
        encodedAsset,
        value: perNoteAmount.toBigInt(),
        depositAddr: addr,
        nonce: nonce.toBigInt(),
        gasCompensation: BigInt(0),
      };

      const instantiateDepositTx = await depositManager
        .connect(deployer)
        .instantiateDeposit(depositRequest);
      await instantiateDepositTx.wait(1);

      // TODO: remove self signing once we have real deposit screener agent
      // We currently ensure all EOAs are registered as screeners as temp setup
      const domain: EIP712Domain = {
        name: "NocturneDepositManager",
        version: "v1",
        chainId,
        verifyingContract: depositManager.address,
      };
      const signature = await signDepositRequest(
        deployer,
        domain,
        depositRequest
      );

      const processDepositTx = await depositManager.processDeposit(
        depositRequest,
        signature
      );
      await processDepositTx.wait(1);
    }
  }

  await wallet.connect(deployerEoa).fillBatchWithZeros();
})();
