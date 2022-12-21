import { setup } from "../deploy/deployNocturne";
const hre = require("hardhat");
import { SimpleERC20Token__factory } from "@nocturne-xyz/contracts";
import { ERC20_ID } from "@nocturne-xyz/sdk";

(async () => {
  const { wallet, vault, nocturneContextAlice } = await setup();
  const nocturneAddress = nocturneContextAlice.signer.address;
  console.log("Test Nocturne signer privkey: ", nocturneContextAlice.signer.privkey);

  const [eoa] = await hre.ethers.getSigners();
  const tokenFactory = new SimpleERC20Token__factory(eoa);
  const token = await tokenFactory.deploy();
  console.log("Token deployed at: ", token.address);

  token.reserveTokens(eoa.address, 1000);
  await token.connect(eoa).approve(vault.address, 200);

  const amounts = [100n, 100n];
  for (let i = 0; i < amounts.length; i++) {
    await wallet.connect(eoa).depositFunds({
      spender: eoa.address,
      asset: token.address,
      value: amounts[i],
      id: ERC20_ID,
      depositAddr: nocturneAddress,
    });
  }
})();
