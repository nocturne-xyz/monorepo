import { setup } from "../deploy/deployNocturne";
const hre = require("hardhat");
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import {
  Asset,
  AssetType,
  encodeAsset,
  ERC20_ID,
  NocturneAddressTrait,
  CanonAddress,
} from "@nocturne-xyz/sdk";

// add MM Flask addresses here
const TEST_USER_ADDRS = ["0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5"];

// add canonical nocturne addresses for testing here
const TEST_CANONICAL_ADDRS: CanonAddress[] = [
  [
    3711321679534668708996949294670563968795225903991134380930495432172275252741n,
    13294751746981267114060702819072399552602378998462805956484142894638781668216n,
  ],
];

(async () => {
  const { wallet, vault, nocturneContextAlice } = await setup();
  const nocturneAddressAlice = nocturneContextAlice.signer.address;

  const [eoa] = await hre.ethers.getSigners();
  const tokenFactory = new SimpleERC20Token__factory(eoa);
  const token = await tokenFactory.deploy();
  console.log("Token deployed at: ", token.address);

  await token.reserveTokens(eoa.address, 100000000);
  for (const addr of TEST_USER_ADDRS) {
    await token.reserveTokens(addr, 1000);
  }

  await token.connect(eoa).approve(vault.address, 100000000);

  const deposit = async (nocturneAddress, amount) => {
    const asset: Asset = {
      assetType: AssetType.ERC20,
      assetAddr: token.address,
      id: ERC20_ID,
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

  const testAddrs = TEST_CANONICAL_ADDRS.map((canonicalAddr) =>
    NocturneAddressTrait.fromCanonAddress(canonicalAddr)
  );

  const targetAddrs = [nocturneAddressAlice, ...testAddrs];

  const proms = [];
  for (const addr of targetAddrs) {
    console.log("depositing 2 100 token notes to", addr);
    proms.push(deposit(addr, 100));
    proms.push(deposit(addr, 100));
  }

  await Promise.all(proms);
})();
