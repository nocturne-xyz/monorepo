import { Address, execAsync } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as JSON from "bigint-json-serialization";

const ROOT_DIR = findWorkspaceRoot()!;

export type NocturneProxyContractName =
  | "CanonicalAddressRegistry"
  | "DepositManager"
  | "Teller"
  | "Handler";
export type NocturneOthersContractName =
  | "PoseidonExtT7"
  | "JoinSplitVerifier"
  | "SubtreeUpdateVerifier"
  | "TestSubtreeUpdateVerifier"
  | "CanonAddrSigCheckVerifier"
  | "EthTransferAdapter"
  | "WstethAdapter"
  | "RethAdapter";

export function isNocturneProxy(name: string): boolean {
  return [
    "CanonicalAddressRegistry",
    "DepositManager",
    "Teller",
    "Handler",
  ].includes(name);
}

export function isNocturneOther(name: string): boolean {
  return [
    "PoseidonExtT7",
    "JoinSplitVerifier",
    "SubtreeUpdateVerifier",
    "TestSubtreeUpdateVerifier",
    "CanonAddrSigCheckVerifier",
    "EthTransferAdapter",
    "WstethAdapter",
    "RethAdapter",
  ].includes(name);
}

export interface NocturneDeploymentVerificationData {
  chain: string;
  chainId: number;
  numOptimizations: number;
  proxies: { [T in NocturneProxyContractName]: ProxyContractVerification<T> };
  others: { [T in NocturneOthersContractName]: ContractVerification<T> };
}

export class NocturneDeploymentVerification {
  readonly verificationData: NocturneDeploymentVerificationData;

  constructor(verificationData: NocturneDeploymentVerificationData) {
    this.verificationData = verificationData;
  }

  async verify(): Promise<void> {
    const proms = [];
    for (const proxy of Object.values(this.verificationData.proxies)) {
      proms.push(verifyProxyContract(this.verificationData.chain, proxy));
    }
    for (const other of Object.values(this.verificationData.others)) {
      proms.push(verifyContract(this.verificationData.chain, other));
    }

    await Promise.all(proms);
  }

  toString(): string {
    return JSON.stringify(this.verificationData);
  }

  static fromString(json: string): NocturneDeploymentVerification {
    return new NocturneDeploymentVerification(
      JSON.parse(json) as NocturneDeploymentVerificationData
    );
  }
}

export interface ContractVerification<T> {
  contractName: T;
  address: Address;
  constructorArgs: string[];
}

export interface ProxyContractVerification<T> extends ContractVerification<T> {
  implementationAddress: Address;
}

export async function verifyProxyContract<T>(
  network: string,
  proxyVerification: ProxyContractVerification<T>
): Promise<void> {
  console.log(
    `verifying proxy: ${proxyVerification.contractName}:${proxyVerification.address}`
  );
  const proxyProm = verifyContract(network, proxyVerification);

  console.log(
    `verifying implementation ${proxyVerification.contractName}:${proxyVerification.implementationAddress}`
  );
  const implementationProm = verifyContract(network, {
    contractName: proxyVerification.contractName,
    address: proxyVerification.implementationAddress,
    constructorArgs: [],
  });

  await Promise.all([proxyProm, implementationProm]);
}

export async function verifyContract<T>(
  network: string,
  { address, constructorArgs }: ContractVerification<T>
): Promise<void> {
  let args = `${address}`;
  if (constructorArgs) {
    args = args.concat(` ${constructorArgs.join(" ")}`);
  }
  await execAsync(
    `${ROOT_DIR}/packages/deploy/scripts/verify.sh ${args} --network ${network}`
  );
}
