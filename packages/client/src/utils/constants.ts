export function chainIdToNetworkName(chainId: bigint): string {
  switch (chainId) {
    case 1n:
      return "mainnet";
    case 5n:
      return "goerli";
    case 11155111n:
      return "sepolia";
    case 31337n:
      return "localhost";
    default:
      throw new Error(`unsupported chainId: ${chainId}`);
  }
}
