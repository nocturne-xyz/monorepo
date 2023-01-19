import { setup } from "../deploy/deployNocturne";
const hre = require("hardhat");
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  Asset,
  AssetType,
  encodeAsset,
  NocturneAddressTrait,
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
  const { wallet, vault, nocturneContextAlice } = await setup();
  const nocturneAddressAlice = nocturneContextAlice.signer.address;

  const [depositor] = await hre.ethers.getSigners();
  const tokenFactory = new SimpleERC20Token__factory(depositor);

  for (let i = 0; i < 2; i++) {
    const token = await tokenFactory.deploy();

    console.log(`Token ${i + 1} deployed at: ${token.address}`);

    // Reserve tokens to eth addresses
    for (const addr of TEST_ETH_ADDRS) {
      await token.reserveTokens(addr, 1000);
    }

    // Reserve and approve tokens for nocturne addr depositor
    await token.reserveTokens(depositor.address, 100000000);
    await token.connect(depositor).approve(vault.address, 100000000);

    // We will deposit to setup alice and test nocturne addrs
    const testAddrs = TEST_CANONICAL_NOCTURNE_ADDRS.map(
      NocturneAddressTrait.fromCanonAddress
    );
    const targetAddrs = [nocturneAddressAlice, ...testAddrs];

    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: 0n,
    };
    const { encodedAssetAddr, encodedAssetId } = encodeAsset(asset);

    // Deposit two 100 unit notes for given token
    const depositProms: Promise<any>[] = [];
    for (const addr of targetAddrs) {
      console.log("depositing 2 100 token notes to", addr);
      depositProms.push(
        wallet.connect(depositor).depositFunds({
          encodedAssetAddr,
          encodedAssetId,
          spender: depositor.address,
          value: 100n,
          depositAddr: addr,
        })
      );
      depositProms.push(
        wallet.connect(depositor).depositFunds({
          encodedAssetAddr,
          encodedAssetId,
          spender: depositor.address,
          value: 100n,
          depositAddr: addr,
        })
      );
    }

    await Promise.all(depositProms);
  }
})();
