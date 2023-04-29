import { ProtocolWhitelistEntry } from "./config";
import { Handler } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { protocolWhitelistKey } from "@nocturne-xyz/sdk";

export async function whitelistProtocols(
  connectedSigner: ethers.Wallet,
  protocolWhitelist: Map<string, ProtocolWhitelistEntry>,
  handler: Handler
): Promise<void> {
  handler = handler.connect(connectedSigner);

  let proms: Promise<ethers.ContractTransaction>[] = [];
  for (const [name, entry] of protocolWhitelist.entries()) {
    const { contractAddress, functionSignatures } = entry;
    for (const signature of functionSignatures) {
      const selector = ethers.utils.keccak256(signature);
      const key = protocolWhitelistKey(contractAddress, selector);

      if (!(await handler._callableContractAllowlist(key))) {
        console.log(
          `whitelisting protocol: ${name}. address: ${contractAddress}. signature: ${signature}.`
        );
        const tx = handler.setCallableContractAllowlistPermission(
          contractAddress,
          ethers.utils.keccak256(signature),
          true
        );
        proms.push(tx);
      }
    }
  }

  await Promise.all(proms);
}
