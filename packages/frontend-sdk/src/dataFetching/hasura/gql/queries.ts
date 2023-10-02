import { graphql } from "./autogenerated";


export const SdkEventsPaginatedById = graphql(`
  query fetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {
    goerli_goerli_sdk_event(where: { id: { _gte: $from }, block: { _lt: $toBlock }}, order_by: { id: asc }, limit: $limit) {
      id
      merkle_index
      encoded_note_encoded_asset_addr
      encoded_note_encoded_asset_id
      encoded_note_nonce
      encoded_note_owner_h1
      encoded_note_owner_h2
      encoded_note_value
      encrypted_note_ciphertext_bytes
      encrypted_note_commitment
      encrypted_note_encapsulated_secret_bytes
      nullifier
    }
    goerli_goerli_subtree_commit(where: { block: { _lt: $toBlock }}, limit: 1, order_by: {id: desc}) {
      subtree_batch_offset
    }
  }
`);

export const DepositRequestsBySpender = graphql(`
  query fetchDepositRequests($spender: bytea!) {
    goerli_goerli_deposit_request(where: {spender: {_eq: $spender}}) {
      status
      encoded_asset_addr
      encoded_asset_id
      value
      deposit_addr_h1
      deposit_addr_h2
      nonce
      gas_compensation
      instantiation_tx_hash
      completion_tx_hash
      retrieval_tx_hash
      created_at_total_entity_index
    }
  }
`);

export const DepositRequestStatusById = graphql(`
  query fetchDepositStatus($hash: String!) {
    goerli_goerli_deposit_request(where: {id: {_eq: $hash}}) {
      status
    }
  }
`);
