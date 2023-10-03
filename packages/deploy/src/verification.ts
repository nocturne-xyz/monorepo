import { execSync } from "child_process";
import { Address } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as JSON from "bigint-json-serialization";

const ROOT_DIR = findWorkspaceRoot()!;

export type NocturneProxySemanticName =
  | "CanonicalAddressRegistry"
  | "DepositManager"
  | "Teller"
  | "Handler";
export type NocturneOthersSemanticName =
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
  proxies: { [T in NocturneProxySemanticName]: ProxyContractVerification<T> };
  // TODO: others
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
  semanticName: T;
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
    `verifying proxy: ${proxyVerification.semanticName}:${proxyVerification.address}`
  );
  verifyContract(network, proxyVerification);

  console.log(
    `verifying implementation ${proxyVerification.semanticName}:${proxyVerification.implementationAddress}`
  );
  verifyContract(network, {
    semanticName: proxyVerification.semanticName,
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
