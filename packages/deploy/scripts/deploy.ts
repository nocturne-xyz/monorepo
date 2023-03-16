// import { ethers } from "ethers";
// import { deployNocturne } from "../src/deploy";
// import * as dotenv from "dotenv";
// import * as fs from "fs";
// import { checkNocturneContractDeployment } from "../src/checks";

// const DEPLOYS_DIR = `${__dirname}/../deploys/`;

// dotenv.config();

// (async () => {
//   const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
//   if (!proxyAdminOwner) throw new Error("Missing proxy admin owner address");

//   const useMockSubtreeUpdateVerifier =
//     process.env.USE_MOCK_SUBTREE_UPDATE_VERIFIER != undefined;

//   const deployerKey = process.env.DEPLOYER_KEY;
//   if (!deployerKey) throw new Error("Missing deployer key");

//   const rpcUrl = process.env.RPC_URL;
//   if (!rpcUrl) throw new Error("Missing rpc url");

//   const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
//   const deployer = new ethers.Wallet(deployerKey, provider);

//   const deployment = await deployNocturne(proxyAdminOwner, {
//     useMockSubtreeUpdateVerifier,
//   });

//   console.log(deployment);

//   await checkNocturneContractDeployment(deployment, provider);

//   if (!fs.existsSync(DEPLOYS_DIR)) {
//     fs.mkdirSync(DEPLOYS_DIR);
//   }

//   fs.writeFileSync(
//     `${DEPLOYS_DIR}/${deployment.network.name}-${Date.now().toString()}.json`,
//     JSON.stringify(deployment),
//     {
//       encoding: "utf8",
//       flag: "w",
//     }
//   );

//   process.exit(0);
// })();
