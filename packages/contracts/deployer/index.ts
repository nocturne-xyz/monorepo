import { deployNocturne } from './deploy';
import * as fs from 'fs';

(async () => {
  const network = process.env.HARDHAT_NETWORK;
  if (!network) throw new Error('Deploy script missing network');

  const proxyAdminOwner = process.env.PROXY_ADMIN_OWNER;
  if (!proxyAdminOwner)
    throw new Error('Deploy script missing proxy admin owner address');

  const deployment = await deployNocturne(network, proxyAdminOwner, {
    mockSubtreeUpdateVerifier: true,
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
