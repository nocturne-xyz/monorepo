import Dockerode from "dockerode";
import { KEYS } from "../src/keys";
import { startHardhatNetwork } from "../src/hardhat";

const docker = new Dockerode();
(async () => {
  const container = await startHardhatNetwork(docker, {
    blockTime: 3_000,
    keys: KEYS,
  });

  container.logs(
    { follow: true, stdout: true, stderr: true },
    (err, stream) => {
      if (err) {
        console.error(err);
        return;
      }

      stream!.pipe(process.stdout);
    }
  );

  await container.wait();
})();
