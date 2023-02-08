import { setupNocturne } from "../utils/deploy";
import { ethers } from "hardhat";
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  AssetTrait,
  AssetType,
  StealthAddressTrait,
  CanonAddress,
} from "@nocturne-xyz/sdk";

// add MM Flask addresses here
const TEST_ETH_ADDRS = [
  "0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4",
  "0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5",
];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_NOCTURNE_ADDRS: CanonAddress[] = [
  [
    16661918698184082701867644973051718252577732190525285901425619256967874995526n,
    21774950767977261827243047520039323470502341074930938979755949913997413952773n,
  ],
  [
    3711321679534668708996949294670563968795225903991134380930495432172275252741n,
    13294751746981267114060702819072399552602378998462805956484142894638781668216n,
  ],
];

(async () => {
  console.log("Post deploy setup");
  const [depositor] = await ethers.getSigners();
  const { wallet, vault } = await setupNocturne(depositor);
  const tokenFactory = new SimpleERC20Token__factory(depositor);
  const tokens = await Promise.all(
    Array(2)
      .fill(0)
      .map(async (_, i) => {
        const token = await tokenFactory.deploy();
        console.log(`Token ${i + 1} deployed at: ${token.address}`);

        return token;
      })
  );

  for (const token of tokens) {
    // Reserve tokens to eth addresses
    for (const addr of TEST_ETH_ADDRS) {
      console.log(`Sending ETH and tokens to ${addr}`);
      await depositor.sendTransaction({
        to: addr,
        value: ethers.utils.parseEther("10.0"),
      });
      await token.reserveTokens(addr, ethers.utils.parseEther("10.0"));
    }

    // Reserve and approve tokens for nocturne addr depositor
    const reserveAmount = ethers.utils.parseEther("100.0");
    await token
      .connect(depositor)
      .reserveTokens(depositor.address, reserveAmount);
    await token.connect(depositor).approve(vault.address, reserveAmount);
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
      await wallet.connect(depositor).depositFunds(
        {
          encodedAssetAddr,
          encodedAssetId,
          spender: depositor.address,
          value: perNoteAmount,
          depositAddr: addr,
        },
        {
          gasLimit: 1000000,
        }
      );
    }
  }

  await wallet.connect(depositor).fillBatchWithZeros();
})();
