import { ProtocolAllowlist } from "@nocturne-xyz/config";
import { Handler } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";

export async function whitelistProtocols(
  connectedSigner: ethers.Wallet,
  protocolWhitelist: ProtocolAllowlist,
  handler: Handler
): Promise<void> {
  handler = handler.connect(connectedSigner);

  console.log("whitelisting protocols...");
  for (const [name, entry] of Array.from(protocolWhitelist)) {
    const { contractAddress, functionSignatures } = entry;
    for (const signature of functionSignatures) {
      if (!(await handler._supportedContractAllowlist(contractAddress))) {
        console.log(
          `whitelisting protocol: ${name}. address: ${contractAddress}. signature: ${signature}.`
        );
        const tx = await handler.setSupportedContractAllowlistPermission(
          contractAddress,
          true
        );
        await tx.wait(1);
      }
    }
  }
}
