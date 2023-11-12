import {
  AssetTrait,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  StealthAddressTrait,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  batchOffsetToLatestMerkleIndexInBatch,
  ArrayElem,
  Address,
} from "@nocturne-xyz/core";
import { Client as UrqlClient } from "@urql/core";
import { GoerliFetchSdkEventsQuery } from "../gql/autogenerated/graphql";
import { ethers } from "ethers";
import {
  GoerliLatestIndexedMerkleIndex,
  GoerliLatestIndexedMerkleIndexUpToBlock,
  GoerliSdkEventsPaginatedById,
  MainnetLatestIndexedMerkleIndex,
  MainnetLatestIndexedMerkleIndexUpToBlock,
  MainnetSdkEventsPaginatedById,
} from "../gql/queries";

export type HasuraSupportedNetwork = "goerli" | "mainnet";
export const HasuraSupportedNetworks = ["goerli", "mainnet"];

const GoerliQueries = {
  SdkEventsPaginatedById: GoerliSdkEventsPaginatedById,
  LatestIndexedMerkleIndexUpToBlock: GoerliLatestIndexedMerkleIndexUpToBlock,
  LatestIndexedMerkleIndex: GoerliLatestIndexedMerkleIndex,
};

const MainnetQueries = {
  SdkEventsPaginatedById: MainnetSdkEventsPaginatedById,
  LatestIndexedMerkleIndexUpToBlock: MainnetLatestIndexedMerkleIndexUpToBlock,
  LatestIndexedMerkleIndex: MainnetLatestIndexedMerkleIndex,
};

const QueriesByNetwork = {
  goerli: GoerliQueries,
  mainnet: MainnetQueries,
};

export type FetchLatestIndexedMerkleIndexFn = (
  toBlock?: number
) => Promise<number | undefined>;
export type FetchSdkEventsAndLatestCommitedMerkleIndexFn = (
  from: TotalEntityIndex,
  toBlock: number,
  limit?: number
) => Promise<SdkEventsWithLatestCommittedMerkleIndex>;

export function makeFetchLatestIndexedMerkleIndex<N>(
  client: UrqlClient,
  network: HasuraSupportedNetwork
): FetchLatestIndexedMerkleIndexFn {
  const { LatestIndexedMerkleIndex, LatestIndexedMerkleIndexUpToBlock } =
    QueriesByNetwork[network];
  return async (toBlock?: number) => {
    let data, error;
    if (!toBlock) {
      ({ data, error } = await client.query(LatestIndexedMerkleIndex, {}));
    } else {
      ({ data, error } = await client.query(LatestIndexedMerkleIndexUpToBlock, {
        toBlock,
      }));
    }

    if (error || !data) {
      throw new Error(
        error?.message ?? "LatestIndexedMerkleIndex query failed"
      );
    }

    //@ts-ignore
    const sdkEventMerkleIndex = data[`${network}_sdk_events_aggregate`]
      .aggregate?.max?.merkle_index as string | undefined;

    return sdkEventMerkleIndex ? parseInt(sdkEventMerkleIndex) : undefined;
  };
}

type SdkEvent =
  | IncludedNote
  | IncludedEncryptedNote
  | Nullifier
  | FilledBatchWithZerosEndMerkleIndex;
type FilledBatchWithZerosEndMerkleIndex = number;
type SdkEventsWithLatestCommittedMerkleIndex = {
  events: WithTotalEntityIndex<SdkEvent>[];
  latestCommittedMerkleIndex?: number;
};
type SdkEventResponse = ArrayElem<
  GoerliFetchSdkEventsQuery["goerli_sdk_events"]
>;
type SubtreeCommitResponse = ArrayElem<
  GoerliFetchSdkEventsQuery["goerli_subtree_commits"]
>;

export function makeFetchSdkEventsAndLatestCommittedMerkleIndex(
  client: UrqlClient,
  network: HasuraSupportedNetwork
): FetchSdkEventsAndLatestCommitedMerkleIndexFn {
  const { SdkEventsPaginatedById } = QueriesByNetwork[network];
  return async (from: TotalEntityIndex, toBlock: number, limit = 1000) => {
    const { data, error } = await client.query(SdkEventsPaginatedById, {
      from: TotalEntityIndexTrait.toStringPadded(from),
      toBlock,
      limit,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "SdkEvents query failed");
    }

    //@ts-ignore
    const eventResponses = data[`${network}_sdk_events`] as SdkEventResponse[];
    const events: WithTotalEntityIndex<SdkEvent>[] = eventResponses.map(
      (res) => {
        const totalEntityIndex = BigInt(res.id);
        const event =
          tryIncludedEncryptedNoteFromSdkEventResponse(res) ??
          tryIncludedNoteFromSdkEventResponse(res) ??
          tryNullifierFromSdkEventResponse(res) ??
          tryFilledBatchWithZerosEndMerkleIndexFromSdkEventResponse(res);

        if (!event) {
          throw new Error("Invalid SdkEvent response");
        }

        return {
          totalEntityIndex,
          inner: event,
        };
      }
    );

    let latestCommittedMerkleIndex: number | undefined = undefined;

    //@ts-ignore
    const subtreeCommits = data[
      `${network}_subtree_commits`
    ] as SubtreeCommitResponse[];

    if (subtreeCommits && subtreeCommits.length > 0) {
      const subtreeCommit = subtreeCommits[0];
      const batchOffset = parseInt(subtreeCommit.subtree_batch_offset);
      latestCommittedMerkleIndex =
        batchOffsetToLatestMerkleIndexInBatch(batchOffset);
    }

    return {
      events,
      latestCommittedMerkleIndex,
    };
  };
}

function tryIncludedNoteFromSdkEventResponse(
  res: SdkEventResponse
): IncludedNote | undefined {
  if (
    res &&
    res.merkle_index &&
    res.encoded_note_encoded_asset_addr &&
    res.encoded_note_encoded_asset_id &&
    res.encoded_note_owner_h1 &&
    res.encoded_note_owner_h2 &&
    res.encoded_note_value &&
    res.encoded_note_nonce &&
    !res.encrypted_note_ciphertext_bytes &&
    !res.encrypted_note_commitment &&
    !res.encrypted_note_encapsulated_secret_bytes &&
    !res.nullifier
  ) {
    return {
      owner: StealthAddressTrait.decompress({
        h1: BigInt(res.encoded_note_owner_h1 as string),
        h2: BigInt(res.encoded_note_owner_h2 as string),
      }),
      asset: AssetTrait.decode({
        encodedAssetAddr: BigInt(res.encoded_note_encoded_asset_addr as string),
        encodedAssetId: BigInt(res.encoded_note_encoded_asset_id as string),
      }),
      value: BigInt(res.encoded_note_value as string),
      nonce: BigInt(res.encoded_note_nonce as string),
      merkleIndex: parseInt(res.merkle_index as string),
    };
  }

  return undefined;
}

function tryIncludedEncryptedNoteFromSdkEventResponse(
  res: SdkEventResponse
): IncludedEncryptedNote | undefined {
  if (
    res &&
    res.merkle_index &&
    res.encrypted_note_ciphertext_bytes &&
    res.encrypted_note_commitment &&
    res.encrypted_note_encapsulated_secret_bytes &&
    !res.encoded_note_encoded_asset_addr &&
    !res.encoded_note_encoded_asset_id &&
    !res.encoded_note_owner_h1 &&
    !res.encoded_note_owner_h2 &&
    !res.encoded_note_value &&
    !res.encoded_note_nonce &&
    !res.nullifier
  ) {
    return {
      ciphertextBytes: Array.from(
        ethers.utils.arrayify(
          hexStringFromBytea(res.encrypted_note_ciphertext_bytes as string)
        )
      ),
      encapsulatedSecretBytes: Array.from(
        ethers.utils.arrayify(
          hexStringFromBytea(
            res.encrypted_note_encapsulated_secret_bytes as string
          )
        )
      ),
      commitment: BigInt(res.encrypted_note_commitment as string),
      merkleIndex: parseInt(res.merkle_index as string),
    };
  }

  return undefined;
}

function tryNullifierFromSdkEventResponse(
  res: SdkEventResponse
): Nullifier | undefined {
  if (
    res &&
    res.nullifier &&
    !res.merkle_index &&
    !res.encrypted_note_ciphertext_bytes &&
    !res.encrypted_note_commitment &&
    !res.encrypted_note_encapsulated_secret_bytes &&
    !res.encoded_note_encoded_asset_addr &&
    !res.encoded_note_encoded_asset_id &&
    !res.encoded_note_owner_h1 &&
    !res.encoded_note_owner_h2 &&
    !res.encoded_note_value &&
    !res.encoded_note_nonce
  ) {
    return BigInt(res.nullifier as string);
  }

  return undefined;
}

function tryFilledBatchWithZerosEndMerkleIndexFromSdkEventResponse(
  res: SdkEventResponse
): FilledBatchWithZerosEndMerkleIndex | undefined {
  if (
    res &&
    res.merkle_index &&
    !res.encrypted_note_ciphertext_bytes &&
    !res.encrypted_note_commitment &&
    !res.encrypted_note_encapsulated_secret_bytes &&
    !res.encoded_note_encoded_asset_addr &&
    !res.encoded_note_encoded_asset_id &&
    !res.encoded_note_owner_h1 &&
    !res.encoded_note_owner_h2 &&
    !res.encoded_note_value &&
    !res.encoded_note_nonce &&
    !res.nullifier
  ) {
    return parseInt(res.merkle_index as string);
  }

  return undefined;
}

function hexStringFromBytea(bytea: string): Address {
  return "0x" + bytea.slice(2);
}
