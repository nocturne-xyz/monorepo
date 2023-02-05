import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import {
  StealthAddress,
  NoteTrait,
  SubtreeUpdateProver,
  MockSubtreeUpdateProver,
  encodeAsset,
  AssetType,
} from "@nocturne-xyz/sdk";
import { RapidsnarkSubtreeUpdateProver } from "@nocturne-xyz/subtree-updater";
import { Vault, Wallet } from "@nocturne-xyz/contracts";
import { WasmSubtreeUpdateProver } from "@nocturne-xyz/local-prover";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import findWorkspaceRoot from "find-yarn-workspace-root";

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

export async function depositFunds(
  wallet: Wallet,
  vault: Vault,
  token: SimpleERC20Token,
  eoa: ethers.Signer,
  stealthAddress: StealthAddress,
  amounts: bigint[],
  startNonce = 0
): Promise<bigint[]> {
  const total = amounts.reduce((sum, a) => sum + a);
  token.reserveTokens(eoa.address, total);
  await token.connect(eoa).approve(vault.address, total);

  const asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  const { encodedAssetAddr, encodedAssetId } = encodeAsset(asset);

  const commitments = [];
  for (let i = 0; i < amounts.length; i++) {
    await wallet.connect(eoa).depositFunds({
      spender: eoa.address as string,
      encodedAssetAddr,
      encodedAssetId,
      value: amounts[i],
      depositAddr: stealthAddress,
    });

    const note = {
      owner: stealthAddress,
      nonce: BigInt(i + startNonce),
      asset,
      value: amounts[i],
    };
    commitments.push(NoteTrait.toCommitment(note));
  }

  return commitments;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSubtreeUpdateProver(): SubtreeUpdateProver {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return new RapidsnarkSubtreeUpdateProver(
      EXECUTABLE_CMD,
      WITNESS_GEN_EXECUTABLE_PATH,
      ZKEY_PATH,
      VKEY_PATH,
      TMP_PATH
    );
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
    return new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  }

  return new MockSubtreeUpdateProver();
}

export function getSubtreeUpdaterDelay(): number {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return MOCK_SUBTREE_UPDATER_DELAY + 8000;
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return MOCK_SUBTREE_UPDATER_DELAY + 60000;
  }

  return MOCK_SUBTREE_UPDATER_DELAY;
}
