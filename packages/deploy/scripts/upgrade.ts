import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  DepositManager__factory,
  Handler__factory,
  ProxyAdmin__factory,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
// import { checkNocturneDeployment } from "../src/checks";

dotenv.config();

(async () => {
  const configName = process.env.CONFIG_NAME;
  if (!configName) throw new Error("Missing CONFIG_NAME");

  const deployerKey = process.env.DEPLOYER_KEY;
  if (!deployerKey) throw new Error("Missing DEPLOYER_KEY");

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL");

  console.log("getting provider and signer");
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);

  console.log("getting config");
  const config = loadNocturneConfigBuiltin(configName);
  const proxyAdminAddress = config.contracts.proxyAdmin;

  console.log("connecting to proxy admin");
  const proxyAdmin = ProxyAdmin__factory.connect(proxyAdminAddress, deployer);

  const newDepositManagerImpl = await new DepositManager__factory(
    deployer
  ).deploy();
  const newTellerImpl = await new Teller__factory(deployer).deploy();
  const newHandlerImpl = await new Handler__factory(deployer).deploy();

  console.log("upgrading deposit manager");
  const depositManagerUpgradeTx = await proxyAdmin.upgrade(
    config.depositManagerAddress(),
    newDepositManagerImpl.address
  );
  const depositManagerReceipt = await depositManagerUpgradeTx.wait();
  console.log("deposit manager upgrade tx receipt: ", depositManagerReceipt);

  console.log("upgrading teller");
  const tellerUpgradeTx = await proxyAdmin.upgrade(
    config.tellerAddress(),
    newTellerImpl.address
  );
  const tellerReceipt = await tellerUpgradeTx.wait();
  console.log("teller upgrade tx receipt: ", tellerReceipt);

  console.log("upgrading handler");
  const handlerUpgradeTx = await proxyAdmin.upgrade(
    config.handlerAddress(),
    newHandlerImpl.address
  );
  const handlerReceipt = await handlerUpgradeTx.wait();
  console.log("handler upgrade tx receipt: ", handlerReceipt);
})();
