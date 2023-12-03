/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
    "\n  query goerliFetchDepositRequests($spender: bytea!) {\n    goerli_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n": types.GoerliFetchDepositRequestsDocument,
    "\n  query goerliFetchDepositStatus($hash: String!) {\n    goerli_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n": types.GoerliFetchDepositStatusDocument,
    "\n  query mainnetFetchDepositRequests($spender: bytea!) {\n    mainnet_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n": types.MainnetFetchDepositRequestsDocument,
    "\n  query mainnetFetchDepositStatus($hash: String!) {\n    mainnet_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n": types.MainnetFetchDepositStatusDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query goerliFetchDepositRequests($spender: bytea!) {\n    goerli_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"): (typeof documents)["\n  query goerliFetchDepositRequests($spender: bytea!) {\n    goerli_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query goerliFetchDepositStatus($hash: String!) {\n    goerli_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"): (typeof documents)["\n  query goerliFetchDepositStatus($hash: String!) {\n    goerli_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query mainnetFetchDepositRequests($spender: bytea!) {\n    mainnet_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"): (typeof documents)["\n  query mainnetFetchDepositRequests($spender: bytea!) {\n    mainnet_deposit_requests(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query mainnetFetchDepositStatus($hash: String!) {\n    mainnet_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"): (typeof documents)["\n  query mainnetFetchDepositStatus($hash: String!) {\n    mainnet_deposit_requests(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;