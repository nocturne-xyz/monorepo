import { execSync } from "child_process";
import { Address } from "./utils";
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
  | "CanonAddrSigCheckVerifier"
  | "EthTransferAdapter"
  | "WstethAdapter"
  | "RethAdapter";

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

  verify(): void {
    for (const proxy of Object.values(this.verificationData.proxies)) {
      verifyProxyContract(this.verificationData.chain, proxy);
    }
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
  constructorArgs?: string[];
}

export interface ProxyContractVerification<T> extends ContractVerification<T> {
  implementationAddress: Address;
}

export function verifyProxyContract<T>(
  network: string,
  proxyVerification: ProxyContractVerification<T>
): void {
  console.log(
    `verifying proxy: ${proxyVerification.contractName}:${proxyVerification.address}`
  );
  verifyContract(network, proxyVerification);

  console.log(
    `verifying implementation ${proxyVerification.contractName}:${proxyVerification.implementationAddress}`
  );
  verifyContract(network, {
    contractName: proxyVerification.contractName,
    address: proxyVerification.implementationAddress,
  });
}

export function verifyContract<T>(
  network: string,
  { address, constructorArgs }: ContractVerification<T>
): void {
  let args = `${address}`;
  if (constructorArgs) {
    args = args.concat(` ${constructorArgs.join(" ")}`);
  }
  execSync(
    `${ROOT_DIR}/packages/deploy/scripts/verify.sh ${args} --network ${network}`
  );
}
