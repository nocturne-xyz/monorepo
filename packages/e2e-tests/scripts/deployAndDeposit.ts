import { setupNocturne } from "../src/deploy";
import { ethers } from "ethers";
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  StealthAddressTrait,
  CanonAddress,
} from "@nocturne-xyz/sdk";
import { KEYS_TO_WALLETS } from "../src/keys";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";

const HH_URL = "http://localhost:8545";

// add MM Flask addresses here
const TEST_ETH_ADDRS = [
  "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
  "0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5",
];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_NOCTURNE_ADDRS: CanonAddress[] = [
  {
    x: 6549694056774134566462390759489107825849258760307389219389742002722634747360n,
    y: 17126786790728454988634080625820792103197279048916335819760874798426276975005n,
  },
  {
    x: 5930792346199870669623382218313068497306693992766287595937046487269838957086n,
    y: 8667252075517012680631890316899517564362805365083760031296113925559064092738n,
  },
];

(async () => {
  console.log("Post deploy setup");
  const provider = new ethers.providers.JsonRpcProvider(HH_URL);
  const [deployer] = KEYS_TO_WALLETS(provider);
  const { wallet, vault } = await setupNocturne(deployer);
  const tokenFactory = new SimpleERC20Token__factory(deployer);
  const tokens: SimpleERC20Token[] = [];
  for (let i = 0; i < 2; i++) {
    const token = await tokenFactory.deploy();
    await token.deployed();
    console.log(`Token ${i + 1} deployed at: ${token.address}`);
    tokens.push(token);
  }

  for (const token of tokens) {
    // Reserve tokens to eth addresses
    for (const addr of TEST_ETH_ADDRS) {
      console.log(`Sending ETH and tokens to ${addr}`);
      await deployer.sendTransaction({
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
    await token.connect(deployer).approve(vault.address, reserveAmount);
  }

  const encodedAssets = tokens
    .map((token) => ({
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    }))
    .map(AssetTrait.encode);

  // We will deposit to setup alice and test nocturne addrs
  const targetAddrs = TEST_CANONICAL_NOCTURNE_ADDRS.map(
    StealthAddressTrait.fromCanonAddress
  );

  const perNoteAmount = ethers.utils.parseEther("10.0");
  for (const { encodedAssetAddr, encodedAssetId } of encodedAssets) {
    // Deposit two 100 unit notes for given token
    for (const addr of targetAddrs) {
      console.log("depositing 1 100 token note to", addr);
      await wallet.connect(deployer).depositFunds(
        {
          encodedAssetAddr,
          encodedAssetId,
          spender: deployer.address,
          value: perNoteAmount,
          depositAddr: addr,
        },
        {
          gasLimit: 1000000,
        }
      );
    }
  }

  await wallet.connect(deployer).fillBatchWithZeros();
})();
