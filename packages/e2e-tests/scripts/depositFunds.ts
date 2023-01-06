import { setup } from "../deploy/deployNocturne";
const hre = require("hardhat");
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import { Asset, AssetType, encodeAsset, ERC20_ID } from "@nocturne-xyz/sdk";

// add MM Flask addresses here
const TEST_USER_ADDRS = ["0x0BA19AfF7aD1e96502eC827587A5A58670162Ac5"];

(async () => {
  const { wallet, vault, nocturneContextAlice } = await setup();
  const nocturneAddress = nocturneContextAlice.signer.address;
  console.log(
    "Test Nocturne signer privkey: ",
    nocturneContextAlice.signer.privkey
  );

  const [eoa] = await hre.ethers.getSigners();
  const tokenFactory = new SimpleERC20Token__factory(eoa);
  const token = await tokenFactory.deploy();
  console.log("Token deployed at: ", token.address);

  await token.reserveTokens(eoa.address, 1000);
  for (const addr of TEST_USER_ADDRS) {
    await token.reserveTokens(addr, 1000);
  }

  await token.connect(eoa).approve(vault.address, 200);

  const amounts = [100n, 100n];
  for (let i = 0; i < amounts.length; i++) {
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
      value: amounts[i],
      depositAddr: nocturneAddress,
    });
  }
})();
