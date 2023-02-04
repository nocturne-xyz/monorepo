import { deployNocturne } from './deploy';
import * as fs from 'fs';
import hardhat from 'hardhat';

(async () => {
  const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
  if (!proxyAdminOwner)
    throw new Error('Deploy script missing proxy admin owner address');

  const useMockSubtreeUpdateVerifier =
    process.env.USE_MOCK_SUBTREE_UPDATE_VERIFIER != undefined;

  const network = hardhat.network.name;
  const deployment = await deployNocturne(hardhat, proxyAdminOwner, {
    useMockSubtreeUpdateVerifier,
  });
  console.log(deployment);

  const deploysDir = `${__dirname}/../deploys/`;
  if (!fs.existsSync(deploysDir)) {
    fs.mkdirSync(deploysDir);
  }

  fs.writeFileSync(
    `${deploysDir}/${network}-${Date.now().toString()}.json`,
    JSON.stringify(deployment),
    {
      encoding: 'utf8',
      flag: 'w',
    },
  );

  process.exit(0);
})();
