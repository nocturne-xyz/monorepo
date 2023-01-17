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
const TEST_ETH_ADDRS = ["0x9dD6B628336ECA9a57e534Fb25F1960fA11038f4"];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_NOCTURNE_ADDRS: CanonAddress[] = [
  [
    16661918698184082701867644973051718252577732190525285901425619256967874995526n,
    21774950767977261827243047520039323470502341074930938979755949913997413952773n,
  ],
];

(async () => {
  const { wallet, vault, nocturneContextAlice } = await setup();
  const nocturneAddressAlice = nocturneContextAlice.signer.address;

  const [eoa] = await hre.ethers.getSigners();
  const tokenFactory = new SimpleERC20Token__factory(eoa);
  const token1 = await tokenFactory.deploy();
  const token2 = await tokenFactory.deploy();
  console.log(`Tokens deployed at ${token1.address} and ${token2.address}`);

  for (const token of [token1, token2]) {
    await token.reserveTokens(eoa.address, 100000000);
    for (const addr of TEST_ETH_ADDRS) {
      await token.reserveTokens(addr, 1000);
    }

    await token.connect(eoa).approve(vault.address, 100000000);

    const deposit = async (nocturneAddress, amount) => {
      const asset: Asset = {
        assetType: AssetType.ERC20,
        assetAddr: token.address,
        id: 0n,
      };

      const { encodedAssetAddr, encodedAssetId } = encodeAsset(asset);

      await wallet.connect(eoa).depositFunds({
        encodedAssetAddr,
        encodedAssetId,
        spender: eoa.address,
        value: amount,
        depositAddr: nocturneAddress,
      });
    };

    const testAddrs = TEST_CANONICAL_NOCTURNE_ADDRS.map(
      NocturneAddressTrait.fromCanonAddress
    );

    const targetAddrs = [nocturneAddressAlice, ...testAddrs];

    const proms: Promise<void>[] = [];
    for (const addr of targetAddrs) {
      console.log("depositing 2 100 token notes to", addr);
      proms.push(deposit(addr, 100));
      proms.push(deposit(addr, 100));
    }

    await Promise.all(proms);
  }
})();
