import { ProtocolWhitelistEntry } from "@nocturne-xyz/config";
import { Handler } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { protocolWhitelistKey } from "@nocturne-xyz/sdk";

export async function whitelistProtocols(
  connectedSigner: ethers.Wallet,
  protocolWhitelist: Map<string, ProtocolWhitelistEntry>,
  handler: Handler
): Promise<void> {
  handler = handler.connect(connectedSigner);

  console.log("whitelisting protocols...");
  for (const [name, entry] of Array.from(protocolWhitelist)) {
    const { contractAddress, functionSignatures } = entry;
    for (const signature of functionSignatures) {
      const selector = getSelector(signature);
      const key = protocolWhitelistKey(contractAddress, selector);

      if (!(await handler._callableContractAllowlist(key))) {
        console.log(
          `whitelisting protocol: ${name}. address: ${contractAddress}. signature: ${signature}.`
        );
        const tx = await handler.setCallableContractAllowlistPermission(
          contractAddress,
          selector,
          true
        );
        await tx.wait(1);
      }
    }
  }
}

function getSelector(signature: string): string {
  const sigBytes = ethers.utils.toUtf8Bytes(signature);
  const hash = ethers.utils.keccak256(sigBytes);
  return ethers.utils.hexDataSlice(hash, 0, 4);
}
