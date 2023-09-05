export function chainIdToNetworkName(chainId: bigint): string {
  switch (chainId) {
    case 1n:
      return "mainnet";
    case 31377n:
      return "localhost";
    case 11155111n:
      return "sepolia";
    default:
      throw new Error(`unsupported chainId: ${chainId}`);
  }
}
