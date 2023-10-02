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
    "\n  query fetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_goerli_sdk_event(where: { id: { _gte: $from }, block: { _lt: $toBlock }}, order_by: { id: asc }, limit: $limit) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_goerli_subtree_commit(where: { block: { _lt: $toBlock }}, limit: 1, order_by: {id: desc}) {\n      subtree_batch_offset\n    }\n  }\n": types.FetchSdkEventsDocument,
    "\n  query fetchDepositRequests($spender: bytea!) {\n    goerli_goerli_deposit_request(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n": types.FetchDepositRequestsDocument,
    "\n  query fetchDepositStatus($hash: String!) {\n    goerli_goerli_deposit_request(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n": types.FetchDepositStatusDocument,
    "\n  query fetchLatestIndexedBlock {\n    goerli_goerli_sdk_event_aggregate {\n      aggregate {\n        max {\n          block\n        }\n      }\n    }\n  }\n": types.FetchLatestIndexedBlockDocument,
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
export function graphql(source: "\n  query fetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_goerli_sdk_event(where: { id: { _gte: $from }, block: { _lt: $toBlock }}, order_by: { id: asc }, limit: $limit) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_goerli_subtree_commit(where: { block: { _lt: $toBlock }}, limit: 1, order_by: {id: desc}) {\n      subtree_batch_offset\n    }\n  }\n"): (typeof documents)["\n  query fetchSdkEvents($from: String!, $toBlock: Int!, $limit: Int!) {\n    goerli_goerli_sdk_event(where: { id: { _gte: $from }, block: { _lt: $toBlock }}, order_by: { id: asc }, limit: $limit) {\n      id\n      merkle_index\n      encoded_note_encoded_asset_addr\n      encoded_note_encoded_asset_id\n      encoded_note_nonce\n      encoded_note_owner_h1\n      encoded_note_owner_h2\n      encoded_note_value\n      encrypted_note_ciphertext_bytes\n      encrypted_note_commitment\n      encrypted_note_encapsulated_secret_bytes\n      nullifier\n    }\n    goerli_goerli_subtree_commit(where: { block: { _lt: $toBlock }}, limit: 1, order_by: {id: desc}) {\n      subtree_batch_offset\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query fetchDepositRequests($spender: bytea!) {\n    goerli_goerli_deposit_request(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"): (typeof documents)["\n  query fetchDepositRequests($spender: bytea!) {\n    goerli_goerli_deposit_request(where: {spender: {_eq: $spender}}) {\n      status\n      encoded_asset_addr\n      encoded_asset_id\n      value\n      deposit_addr_h1\n      deposit_addr_h2\n      nonce\n      gas_compensation\n      instantiation_tx_hash\n      completion_tx_hash\n      retrieval_tx_hash\n      created_at_total_entity_index\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query fetchDepositStatus($hash: String!) {\n    goerli_goerli_deposit_request(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"): (typeof documents)["\n  query fetchDepositStatus($hash: String!) {\n    goerli_goerli_deposit_request(where: {id: {_eq: $hash}}) {\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query fetchLatestIndexedBlock {\n    goerli_goerli_sdk_event_aggregate {\n      aggregate {\n        max {\n          block\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query fetchLatestIndexedBlock {\n    goerli_goerli_sdk_event_aggregate {\n      aggregate {\n        max {\n          block\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;