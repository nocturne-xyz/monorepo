import { NocturneConfig } from "@nocturne-xyz/config";
import { Address } from "../primitives";

export interface Erc20TokenInfo {
  symbol: string;
  decimals: number;
}

export function findInfoByAddressFromConfig(
  config: NocturneConfig,
  tokenContractAddress: Address
): Erc20TokenInfo | undefined {
  return [...config.erc20s.entries()]
    .map(
      ([symbol, config]) =>
        [config.address, { symbol, decimals: Number(config.precision) }] as [
          string,
          Erc20TokenInfo
        ]
    )
    .find(([address]) => address === tokenContractAddress)?.[1];
}
