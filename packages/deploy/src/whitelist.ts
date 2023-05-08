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
  for (const [name, contractAddress] of Array.from(protocolWhitelist)) {
    if (!(await handler._supportedContractAllowlist(contractAddress))) {
      console.log(
        `whitelisting protocol: ${name}. address: ${contractAddress}.`
      );
      const tx = await handler.setSupportedContractAllowlistPermission(
        contractAddress,
        true
      );
      await tx.wait(1);
    }
  }
}
