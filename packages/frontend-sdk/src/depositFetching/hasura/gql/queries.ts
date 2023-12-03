import { graphql } from "./autogenerated";

export const GoerliDepositRequestsBySpender = graphql(`
  query goerliFetchDepositRequests($spender: bytea!) {
    goerli_deposit_requests(where: {spender: {_eq: $spender}}) {
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

export const GoerliDepositRequestStatusById = graphql(`
  query goerliFetchDepositStatus($hash: String!) {
    goerli_deposit_requests(where: {id: {_eq: $hash}}) {
      status
    }
  }
`);

export const MainnetDepositRequestsBySpender = graphql(`
  query mainnetFetchDepositRequests($spender: bytea!) {
    mainnet_deposit_requests(where: {spender: {_eq: $spender}}) {
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

export const MainnetDepositRequestStatusById = graphql(`
  query mainnetFetchDepositStatus($hash: String!) {
    mainnet_deposit_requests(where: {id: {_eq: $hash}}) {
      status
    }
  }
`);
