import Dockerode from "dockerode";
import { sleep } from "./utils";
import { v4 as uuidv4 } from "uuid";

const HH_IMAGE = "hardhat";

interface HardhatNetworkConfig {
  blockTime: number;
  keys: string[];
}

export async function startHardhatNetwork(
  docker: Dockerode,
  config: HardhatNetworkConfig
): Promise<Dockerode.Container> {
  const container = await docker.createContainer({
    Image: HH_IMAGE,
    name: `${HH_IMAGE}-${uuidv4()}`,
    Env: [
      `BLOCK_TIME=${config.blockTime}`,
      ...config.keys.map((key: string, index: number) => {
        return `PRIVATE_KEY${index + 1}=${key.toString()}`;
      }),
    ],
    ExposedPorts: {
      "8545/tcp:": {},
    },
    HostConfig: {
      PortBindings: {
        "8545/tcp": [{ HostPort: "8545" }],
      },
    },
  });
  await container.start();
  await sleep(3_000);
  return container;
}
