/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  bigint: { input: any; output: any; }
  bytea: { input: any; output: any; }
  numeric: { input: any; output: any; }
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']['input']>;
  _gt?: InputMaybe<Scalars['Int']['input']>;
  _gte?: InputMaybe<Scalars['Int']['input']>;
  _in?: InputMaybe<Array<Scalars['Int']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Int']['input']>;
  _lte?: InputMaybe<Scalars['Int']['input']>;
  _neq?: InputMaybe<Scalars['Int']['input']>;
  _nin?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']['input']>;
  _gt?: InputMaybe<Scalars['String']['input']>;
  _gte?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']['input']>;
  _in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']['input']>;
  _lt?: InputMaybe<Scalars['String']['input']>;
  _lte?: InputMaybe<Scalars['String']['input']>;
  _neq?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']['input']>;
  _nin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']['input']>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bigint']['input']>;
  _gt?: InputMaybe<Scalars['bigint']['input']>;
  _gte?: InputMaybe<Scalars['bigint']['input']>;
  _in?: InputMaybe<Array<Scalars['bigint']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['bigint']['input']>;
  _lte?: InputMaybe<Scalars['bigint']['input']>;
  _neq?: InputMaybe<Scalars['bigint']['input']>;
  _nin?: InputMaybe<Array<Scalars['bigint']['input']>>;
};

/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
export type Bytea_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bytea']['input']>;
  _gt?: InputMaybe<Scalars['bytea']['input']>;
  _gte?: InputMaybe<Scalars['bytea']['input']>;
  _in?: InputMaybe<Array<Scalars['bytea']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['bytea']['input']>;
  _lte?: InputMaybe<Scalars['bytea']['input']>;
  _neq?: InputMaybe<Scalars['bytea']['input']>;
  _nin?: InputMaybe<Array<Scalars['bytea']['input']>>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = 'ASC',
  /** descending ordering of the cursor */
  Desc = 'DESC'
}

/** columns and relationships of "goerli.goerli_deposit_event" */
export type Goerli_Goerli_Deposit_Event = {
  __typename?: 'goerli_goerli_deposit_event';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  deposit_addr_h1: Scalars['numeric']['output'];
  deposit_addr_h2: Scalars['numeric']['output'];
  encoded_asset_addr: Scalars['numeric']['output'];
  encoded_asset_id: Scalars['numeric']['output'];
  gas_compensation: Scalars['numeric']['output'];
  id: Scalars['String']['output'];
  nonce: Scalars['numeric']['output'];
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  spender: Scalars['bytea']['output'];
  type: Scalars['String']['output'];
  value: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** Boolean expression to filter rows from the table "goerli.goerli_deposit_event". All fields are combined with a logical 'AND'. */
export type Goerli_Goerli_Deposit_Event_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Goerli_Deposit_Event_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  deposit_addr_h1?: InputMaybe<Numeric_Comparison_Exp>;
  deposit_addr_h2?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_asset_addr?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_asset_id?: InputMaybe<Numeric_Comparison_Exp>;
  gas_compensation?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  nonce?: InputMaybe<Numeric_Comparison_Exp>;
  note_merkle_index?: InputMaybe<Numeric_Comparison_Exp>;
  spender?: InputMaybe<Bytea_Comparison_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  value?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** Ordering options when selecting data from "goerli.goerli_deposit_event". */
export type Goerli_Goerli_Deposit_Event_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  deposit_addr_h1?: InputMaybe<Order_By>;
  deposit_addr_h2?: InputMaybe<Order_By>;
  encoded_asset_addr?: InputMaybe<Order_By>;
  encoded_asset_id?: InputMaybe<Order_By>;
  gas_compensation?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nonce?: InputMaybe<Order_By>;
  note_merkle_index?: InputMaybe<Order_By>;
  spender?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.goerli_deposit_event" */
export enum Goerli_Goerli_Deposit_Event_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  Block = 'block',
  /** column name */
  DepositAddrH1 = 'deposit_addr_h1',
  /** column name */
  DepositAddrH2 = 'deposit_addr_h2',
  /** column name */
  EncodedAssetAddr = 'encoded_asset_addr',
  /** column name */
  EncodedAssetId = 'encoded_asset_id',
  /** column name */
  GasCompensation = 'gas_compensation',
  /** column name */
  Id = 'id',
  /** column name */
  Nonce = 'nonce',
  /** column name */
  NoteMerkleIndex = 'note_merkle_index',
  /** column name */
  Spender = 'spender',
  /** column name */
  Type = 'type',
  /** column name */
  Value = 'value',
  /** column name */
  Vid = 'vid'
}

/** Streaming cursor of the table "goerli_goerli_deposit_event" */
export type Goerli_Goerli_Deposit_Event_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Goerli_Deposit_Event_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Goerli_Deposit_Event_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  deposit_addr_h1?: InputMaybe<Scalars['numeric']['input']>;
  deposit_addr_h2?: InputMaybe<Scalars['numeric']['input']>;
  encoded_asset_addr?: InputMaybe<Scalars['numeric']['input']>;
  encoded_asset_id?: InputMaybe<Scalars['numeric']['input']>;
  gas_compensation?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  nonce?: InputMaybe<Scalars['numeric']['input']>;
  note_merkle_index?: InputMaybe<Scalars['numeric']['input']>;
  spender?: InputMaybe<Scalars['bytea']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** columns and relationships of "goerli.goerli_deposit_request" */
export type Goerli_Goerli_Deposit_Request = {
  __typename?: 'goerli_goerli_deposit_request';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block_range: Scalars['String']['output'];
  completion_tx_hash?: Maybe<Scalars['bytea']['output']>;
  created_at_total_entity_index: Scalars['numeric']['output'];
  deposit_addr_h1: Scalars['numeric']['output'];
  deposit_addr_h2: Scalars['numeric']['output'];
  encoded_asset_addr: Scalars['numeric']['output'];
  encoded_asset_id: Scalars['numeric']['output'];
  gas_compensation: Scalars['numeric']['output'];
  id: Scalars['String']['output'];
  instantiation_tx_hash: Scalars['bytea']['output'];
  nonce: Scalars['numeric']['output'];
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  retrieval_tx_hash?: Maybe<Scalars['bytea']['output']>;
  spender: Scalars['bytea']['output'];
  status: Scalars['String']['output'];
  value: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** Boolean expression to filter rows from the table "goerli.goerli_deposit_request". All fields are combined with a logical 'AND'. */
export type Goerli_Goerli_Deposit_Request_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Goerli_Deposit_Request_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Bool_Exp>>;
  block_range?: InputMaybe<String_Comparison_Exp>;
  completion_tx_hash?: InputMaybe<Bytea_Comparison_Exp>;
  created_at_total_entity_index?: InputMaybe<Numeric_Comparison_Exp>;
  deposit_addr_h1?: InputMaybe<Numeric_Comparison_Exp>;
  deposit_addr_h2?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_asset_addr?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_asset_id?: InputMaybe<Numeric_Comparison_Exp>;
  gas_compensation?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  instantiation_tx_hash?: InputMaybe<Bytea_Comparison_Exp>;
  nonce?: InputMaybe<Numeric_Comparison_Exp>;
  note_merkle_index?: InputMaybe<Numeric_Comparison_Exp>;
  retrieval_tx_hash?: InputMaybe<Bytea_Comparison_Exp>;
  spender?: InputMaybe<Bytea_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  value?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** Ordering options when selecting data from "goerli.goerli_deposit_request". */
export type Goerli_Goerli_Deposit_Request_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block_range?: InputMaybe<Order_By>;
  completion_tx_hash?: InputMaybe<Order_By>;
  created_at_total_entity_index?: InputMaybe<Order_By>;
  deposit_addr_h1?: InputMaybe<Order_By>;
  deposit_addr_h2?: InputMaybe<Order_By>;
  encoded_asset_addr?: InputMaybe<Order_By>;
  encoded_asset_id?: InputMaybe<Order_By>;
  gas_compensation?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  instantiation_tx_hash?: InputMaybe<Order_By>;
  nonce?: InputMaybe<Order_By>;
  note_merkle_index?: InputMaybe<Order_By>;
  retrieval_tx_hash?: InputMaybe<Order_By>;
  spender?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.goerli_deposit_request" */
export enum Goerli_Goerli_Deposit_Request_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  BlockRange = 'block_range',
  /** column name */
  CompletionTxHash = 'completion_tx_hash',
  /** column name */
  CreatedAtTotalEntityIndex = 'created_at_total_entity_index',
  /** column name */
  DepositAddrH1 = 'deposit_addr_h1',
  /** column name */
  DepositAddrH2 = 'deposit_addr_h2',
  /** column name */
  EncodedAssetAddr = 'encoded_asset_addr',
  /** column name */
  EncodedAssetId = 'encoded_asset_id',
  /** column name */
  GasCompensation = 'gas_compensation',
  /** column name */
  Id = 'id',
  /** column name */
  InstantiationTxHash = 'instantiation_tx_hash',
  /** column name */
  Nonce = 'nonce',
  /** column name */
  NoteMerkleIndex = 'note_merkle_index',
  /** column name */
  RetrievalTxHash = 'retrieval_tx_hash',
  /** column name */
  Spender = 'spender',
  /** column name */
  Status = 'status',
  /** column name */
  Value = 'value',
  /** column name */
  Vid = 'vid'
}

/** Streaming cursor of the table "goerli_goerli_deposit_request" */
export type Goerli_Goerli_Deposit_Request_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Goerli_Deposit_Request_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Goerli_Deposit_Request_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block_range?: InputMaybe<Scalars['String']['input']>;
  completion_tx_hash?: InputMaybe<Scalars['bytea']['input']>;
  created_at_total_entity_index?: InputMaybe<Scalars['numeric']['input']>;
  deposit_addr_h1?: InputMaybe<Scalars['numeric']['input']>;
  deposit_addr_h2?: InputMaybe<Scalars['numeric']['input']>;
  encoded_asset_addr?: InputMaybe<Scalars['numeric']['input']>;
  encoded_asset_id?: InputMaybe<Scalars['numeric']['input']>;
  gas_compensation?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  instantiation_tx_hash?: InputMaybe<Scalars['bytea']['input']>;
  nonce?: InputMaybe<Scalars['numeric']['input']>;
  note_merkle_index?: InputMaybe<Scalars['numeric']['input']>;
  retrieval_tx_hash?: InputMaybe<Scalars['bytea']['input']>;
  spender?: InputMaybe<Scalars['bytea']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** columns and relationships of "goerli.goerli_sdk_event" */
export type Goerli_Goerli_Sdk_Event = {
  __typename?: 'goerli_goerli_sdk_event';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  encoded_note_encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  encoded_note_nonce?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_note_value?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_ciphertext_bytes?: Maybe<Scalars['bytea']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_encapsulated_secret_bytes?: Maybe<Scalars['bytea']['output']>;
  id: Scalars['String']['output'];
  merkle_index?: Maybe<Scalars['numeric']['output']>;
  nullifier?: Maybe<Scalars['numeric']['output']>;
  vid: Scalars['bigint']['output'];
};

/** aggregated selection of "goerli.goerli_sdk_event" */
export type Goerli_Goerli_Sdk_Event_Aggregate = {
  __typename?: 'goerli_goerli_sdk_event_aggregate';
  aggregate?: Maybe<Goerli_Goerli_Sdk_Event_Aggregate_Fields>;
  nodes: Array<Goerli_Goerli_Sdk_Event>;
};

/** aggregate fields of "goerli.goerli_sdk_event" */
export type Goerli_Goerli_Sdk_Event_Aggregate_Fields = {
  __typename?: 'goerli_goerli_sdk_event_aggregate_fields';
  avg?: Maybe<Goerli_Goerli_Sdk_Event_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Goerli_Goerli_Sdk_Event_Max_Fields>;
  min?: Maybe<Goerli_Goerli_Sdk_Event_Min_Fields>;
  stddev?: Maybe<Goerli_Goerli_Sdk_Event_Stddev_Fields>;
  stddev_pop?: Maybe<Goerli_Goerli_Sdk_Event_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Goerli_Goerli_Sdk_Event_Stddev_Samp_Fields>;
  sum?: Maybe<Goerli_Goerli_Sdk_Event_Sum_Fields>;
  var_pop?: Maybe<Goerli_Goerli_Sdk_Event_Var_Pop_Fields>;
  var_samp?: Maybe<Goerli_Goerli_Sdk_Event_Var_Samp_Fields>;
  variance?: Maybe<Goerli_Goerli_Sdk_Event_Variance_Fields>;
};


/** aggregate fields of "goerli.goerli_sdk_event" */
export type Goerli_Goerli_Sdk_Event_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Goerli_Goerli_Sdk_Event_Avg_Fields = {
  __typename?: 'goerli_goerli_sdk_event_avg_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "goerli.goerli_sdk_event". All fields are combined with a logical 'AND'. */
export type Goerli_Goerli_Sdk_Event_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  encoded_note_encoded_asset_addr?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_encoded_asset_id?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_nonce?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_owner_h1?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_owner_h2?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_value?: InputMaybe<Numeric_Comparison_Exp>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Bytea_Comparison_Exp>;
  encrypted_note_commitment?: InputMaybe<Numeric_Comparison_Exp>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Bytea_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  merkle_index?: InputMaybe<Numeric_Comparison_Exp>;
  nullifier?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** aggregate max on columns */
export type Goerli_Goerli_Sdk_Event_Max_Fields = {
  __typename?: 'goerli_goerli_sdk_event_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  encoded_note_nonce?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_note_value?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  merkle_index?: Maybe<Scalars['numeric']['output']>;
  nullifier?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Goerli_Goerli_Sdk_Event_Min_Fields = {
  __typename?: 'goerli_goerli_sdk_event_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  encoded_note_nonce?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_note_value?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  merkle_index?: Maybe<Scalars['numeric']['output']>;
  nullifier?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "goerli.goerli_sdk_event". */
export type Goerli_Goerli_Sdk_Event_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  encoded_note_encoded_asset_addr?: InputMaybe<Order_By>;
  encoded_note_encoded_asset_id?: InputMaybe<Order_By>;
  encoded_note_nonce?: InputMaybe<Order_By>;
  encoded_note_owner_h1?: InputMaybe<Order_By>;
  encoded_note_owner_h2?: InputMaybe<Order_By>;
  encoded_note_value?: InputMaybe<Order_By>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Order_By>;
  encrypted_note_commitment?: InputMaybe<Order_By>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  merkle_index?: InputMaybe<Order_By>;
  nullifier?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.goerli_sdk_event" */
export enum Goerli_Goerli_Sdk_Event_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  Block = 'block',
  /** column name */
  EncodedNoteEncodedAssetAddr = 'encoded_note_encoded_asset_addr',
  /** column name */
  EncodedNoteEncodedAssetId = 'encoded_note_encoded_asset_id',
  /** column name */
  EncodedNoteNonce = 'encoded_note_nonce',
  /** column name */
  EncodedNoteOwnerH1 = 'encoded_note_owner_h1',
  /** column name */
  EncodedNoteOwnerH2 = 'encoded_note_owner_h2',
  /** column name */
  EncodedNoteValue = 'encoded_note_value',
  /** column name */
  EncryptedNoteCiphertextBytes = 'encrypted_note_ciphertext_bytes',
  /** column name */
  EncryptedNoteCommitment = 'encrypted_note_commitment',
  /** column name */
  EncryptedNoteEncapsulatedSecretBytes = 'encrypted_note_encapsulated_secret_bytes',
  /** column name */
  Id = 'id',
  /** column name */
  MerkleIndex = 'merkle_index',
  /** column name */
  Nullifier = 'nullifier',
  /** column name */
  Vid = 'vid'
}

/** aggregate stddev on columns */
export type Goerli_Goerli_Sdk_Event_Stddev_Fields = {
  __typename?: 'goerli_goerli_sdk_event_stddev_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Goerli_Goerli_Sdk_Event_Stddev_Pop_Fields = {
  __typename?: 'goerli_goerli_sdk_event_stddev_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Goerli_Goerli_Sdk_Event_Stddev_Samp_Fields = {
  __typename?: 'goerli_goerli_sdk_event_stddev_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "goerli_goerli_sdk_event" */
export type Goerli_Goerli_Sdk_Event_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Goerli_Sdk_Event_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Goerli_Sdk_Event_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  encoded_note_encoded_asset_addr?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_encoded_asset_id?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_nonce?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_owner_h1?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_owner_h2?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_value?: InputMaybe<Scalars['numeric']['input']>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Scalars['bytea']['input']>;
  encrypted_note_commitment?: InputMaybe<Scalars['numeric']['input']>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Scalars['bytea']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  merkle_index?: InputMaybe<Scalars['numeric']['input']>;
  nullifier?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** aggregate sum on columns */
export type Goerli_Goerli_Sdk_Event_Sum_Fields = {
  __typename?: 'goerli_goerli_sdk_event_sum_fields';
  block?: Maybe<Scalars['Int']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  encoded_note_nonce?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_note_value?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['numeric']['output']>;
  merkle_index?: Maybe<Scalars['numeric']['output']>;
  nullifier?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Goerli_Goerli_Sdk_Event_Var_Pop_Fields = {
  __typename?: 'goerli_goerli_sdk_event_var_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Goerli_Goerli_Sdk_Event_Var_Samp_Fields = {
  __typename?: 'goerli_goerli_sdk_event_var_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Goerli_Goerli_Sdk_Event_Variance_Fields = {
  __typename?: 'goerli_goerli_sdk_event_variance_fields';
  block?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  encoded_note_nonce?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['Float']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['Float']['output']>;
  encoded_note_value?: Maybe<Scalars['Float']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['Float']['output']>;
  merkle_index?: Maybe<Scalars['Float']['output']>;
  nullifier?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "goerli.goerli_subtree_commit" */
export type Goerli_Goerli_Subtree_Commit = {
  __typename?: 'goerli_goerli_subtree_commit';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  new_root: Scalars['numeric']['output'];
  subtree_batch_offset: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** Boolean expression to filter rows from the table "goerli.goerli_subtree_commit". All fields are combined with a logical 'AND'. */
export type Goerli_Goerli_Subtree_Commit_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Goerli_Subtree_Commit_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  new_root?: InputMaybe<Numeric_Comparison_Exp>;
  subtree_batch_offset?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** Ordering options when selecting data from "goerli.goerli_subtree_commit". */
export type Goerli_Goerli_Subtree_Commit_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  new_root?: InputMaybe<Order_By>;
  subtree_batch_offset?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.goerli_subtree_commit" */
export enum Goerli_Goerli_Subtree_Commit_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  Block = 'block',
  /** column name */
  Id = 'id',
  /** column name */
  NewRoot = 'new_root',
  /** column name */
  SubtreeBatchOffset = 'subtree_batch_offset',
  /** column name */
  Vid = 'vid'
}

/** Streaming cursor of the table "goerli_goerli_subtree_commit" */
export type Goerli_Goerli_Subtree_Commit_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Goerli_Subtree_Commit_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Goerli_Subtree_Commit_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  new_root?: InputMaybe<Scalars['numeric']['input']>;
  subtree_batch_offset?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** columns and relationships of "goerli.goerli_tree_insertion_event" */
export type Goerli_Goerli_Tree_Insertion_Event = {
  __typename?: 'goerli_goerli_tree_insertion_event';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  encoded_note_encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_note_encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  encoded_note_nonce?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h1?: Maybe<Scalars['numeric']['output']>;
  encoded_note_owner_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_note_value?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_ciphertext_bytes?: Maybe<Scalars['bytea']['output']>;
  encrypted_note_commitment?: Maybe<Scalars['numeric']['output']>;
  encrypted_note_encapsulated_secret_bytes?: Maybe<Scalars['bytea']['output']>;
  filled_batch_with_zeros_num_zeros?: Maybe<Scalars['numeric']['output']>;
  id: Scalars['String']['output'];
  merkle_index: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** Boolean expression to filter rows from the table "goerli.goerli_tree_insertion_event". All fields are combined with a logical 'AND'. */
export type Goerli_Goerli_Tree_Insertion_Event_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  encoded_note_encoded_asset_addr?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_encoded_asset_id?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_nonce?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_owner_h1?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_owner_h2?: InputMaybe<Numeric_Comparison_Exp>;
  encoded_note_value?: InputMaybe<Numeric_Comparison_Exp>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Bytea_Comparison_Exp>;
  encrypted_note_commitment?: InputMaybe<Numeric_Comparison_Exp>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Bytea_Comparison_Exp>;
  filled_batch_with_zeros_num_zeros?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  merkle_index?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** Ordering options when selecting data from "goerli.goerli_tree_insertion_event". */
export type Goerli_Goerli_Tree_Insertion_Event_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  encoded_note_encoded_asset_addr?: InputMaybe<Order_By>;
  encoded_note_encoded_asset_id?: InputMaybe<Order_By>;
  encoded_note_nonce?: InputMaybe<Order_By>;
  encoded_note_owner_h1?: InputMaybe<Order_By>;
  encoded_note_owner_h2?: InputMaybe<Order_By>;
  encoded_note_value?: InputMaybe<Order_By>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Order_By>;
  encrypted_note_commitment?: InputMaybe<Order_By>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Order_By>;
  filled_batch_with_zeros_num_zeros?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  merkle_index?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.goerli_tree_insertion_event" */
export enum Goerli_Goerli_Tree_Insertion_Event_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  Block = 'block',
  /** column name */
  EncodedNoteEncodedAssetAddr = 'encoded_note_encoded_asset_addr',
  /** column name */
  EncodedNoteEncodedAssetId = 'encoded_note_encoded_asset_id',
  /** column name */
  EncodedNoteNonce = 'encoded_note_nonce',
  /** column name */
  EncodedNoteOwnerH1 = 'encoded_note_owner_h1',
  /** column name */
  EncodedNoteOwnerH2 = 'encoded_note_owner_h2',
  /** column name */
  EncodedNoteValue = 'encoded_note_value',
  /** column name */
  EncryptedNoteCiphertextBytes = 'encrypted_note_ciphertext_bytes',
  /** column name */
  EncryptedNoteCommitment = 'encrypted_note_commitment',
  /** column name */
  EncryptedNoteEncapsulatedSecretBytes = 'encrypted_note_encapsulated_secret_bytes',
  /** column name */
  FilledBatchWithZerosNumZeros = 'filled_batch_with_zeros_num_zeros',
  /** column name */
  Id = 'id',
  /** column name */
  MerkleIndex = 'merkle_index',
  /** column name */
  Vid = 'vid'
}

/** Streaming cursor of the table "goerli_goerli_tree_insertion_event" */
export type Goerli_Goerli_Tree_Insertion_Event_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Goerli_Tree_Insertion_Event_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Goerli_Tree_Insertion_Event_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  encoded_note_encoded_asset_addr?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_encoded_asset_id?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_nonce?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_owner_h1?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_owner_h2?: InputMaybe<Scalars['numeric']['input']>;
  encoded_note_value?: InputMaybe<Scalars['numeric']['input']>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Scalars['bytea']['input']>;
  encrypted_note_commitment?: InputMaybe<Scalars['numeric']['input']>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<Scalars['bytea']['input']>;
  filled_batch_with_zeros_num_zeros?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  merkle_index?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** Boolean expression to compare columns of type "numeric". All fields are combined with logical 'AND'. */
export type Numeric_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['numeric']['input']>;
  _gt?: InputMaybe<Scalars['numeric']['input']>;
  _gte?: InputMaybe<Scalars['numeric']['input']>;
  _in?: InputMaybe<Array<Scalars['numeric']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['numeric']['input']>;
  _lte?: InputMaybe<Scalars['numeric']['input']>;
  _neq?: InputMaybe<Scalars['numeric']['input']>;
  _nin?: InputMaybe<Array<Scalars['numeric']['input']>>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "goerli.goerli_deposit_event" */
  goerli_goerli_deposit_event: Array<Goerli_Goerli_Deposit_Event>;
  /** fetch data from the table: "goerli.goerli_deposit_event" using primary key columns */
  goerli_goerli_deposit_event_by_pk?: Maybe<Goerli_Goerli_Deposit_Event>;
  /** fetch data from the table: "goerli.goerli_deposit_request" */
  goerli_goerli_deposit_request: Array<Goerli_Goerli_Deposit_Request>;
  /** fetch data from the table: "goerli.goerli_deposit_request" using primary key columns */
  goerli_goerli_deposit_request_by_pk?: Maybe<Goerli_Goerli_Deposit_Request>;
  /** fetch data from the table: "goerli.goerli_sdk_event" */
  goerli_goerli_sdk_event: Array<Goerli_Goerli_Sdk_Event>;
  /** fetch aggregated fields from the table: "goerli.goerli_sdk_event" */
  goerli_goerli_sdk_event_aggregate: Goerli_Goerli_Sdk_Event_Aggregate;
  /** fetch data from the table: "goerli.goerli_sdk_event" using primary key columns */
  goerli_goerli_sdk_event_by_pk?: Maybe<Goerli_Goerli_Sdk_Event>;
  /** fetch data from the table: "goerli.goerli_subtree_commit" */
  goerli_goerli_subtree_commit: Array<Goerli_Goerli_Subtree_Commit>;
  /** fetch data from the table: "goerli.goerli_subtree_commit" using primary key columns */
  goerli_goerli_subtree_commit_by_pk?: Maybe<Goerli_Goerli_Subtree_Commit>;
  /** fetch data from the table: "goerli.goerli_tree_insertion_event" */
  goerli_goerli_tree_insertion_event: Array<Goerli_Goerli_Tree_Insertion_Event>;
  /** fetch data from the table: "goerli.goerli_tree_insertion_event" using primary key columns */
  goerli_goerli_tree_insertion_event_by_pk?: Maybe<Goerli_Goerli_Tree_Insertion_Event>;
};


export type Query_RootGoerli_Goerli_Deposit_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Event_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Deposit_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Goerli_Deposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Request_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Deposit_Request_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Goerli_Sdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Sdk_Event_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Sdk_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Goerli_Subtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Subtree_Commit_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Subtree_Commit_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Goerli_Tree_Insertion_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>;
};


export type Query_RootGoerli_Goerli_Tree_Insertion_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "goerli.goerli_deposit_event" */
  goerli_goerli_deposit_event: Array<Goerli_Goerli_Deposit_Event>;
  /** fetch data from the table: "goerli.goerli_deposit_event" using primary key columns */
  goerli_goerli_deposit_event_by_pk?: Maybe<Goerli_Goerli_Deposit_Event>;
  /** fetch data from the table in a streaming manner: "goerli.goerli_deposit_event" */
  goerli_goerli_deposit_event_stream: Array<Goerli_Goerli_Deposit_Event>;
  /** fetch data from the table: "goerli.goerli_deposit_request" */
  goerli_goerli_deposit_request: Array<Goerli_Goerli_Deposit_Request>;
  /** fetch data from the table: "goerli.goerli_deposit_request" using primary key columns */
  goerli_goerli_deposit_request_by_pk?: Maybe<Goerli_Goerli_Deposit_Request>;
  /** fetch data from the table in a streaming manner: "goerli.goerli_deposit_request" */
  goerli_goerli_deposit_request_stream: Array<Goerli_Goerli_Deposit_Request>;
  /** fetch data from the table: "goerli.goerli_sdk_event" */
  goerli_goerli_sdk_event: Array<Goerli_Goerli_Sdk_Event>;
  /** fetch aggregated fields from the table: "goerli.goerli_sdk_event" */
  goerli_goerli_sdk_event_aggregate: Goerli_Goerli_Sdk_Event_Aggregate;
  /** fetch data from the table: "goerli.goerli_sdk_event" using primary key columns */
  goerli_goerli_sdk_event_by_pk?: Maybe<Goerli_Goerli_Sdk_Event>;
  /** fetch data from the table in a streaming manner: "goerli.goerli_sdk_event" */
  goerli_goerli_sdk_event_stream: Array<Goerli_Goerli_Sdk_Event>;
  /** fetch data from the table: "goerli.goerli_subtree_commit" */
  goerli_goerli_subtree_commit: Array<Goerli_Goerli_Subtree_Commit>;
  /** fetch data from the table: "goerli.goerli_subtree_commit" using primary key columns */
  goerli_goerli_subtree_commit_by_pk?: Maybe<Goerli_Goerli_Subtree_Commit>;
  /** fetch data from the table in a streaming manner: "goerli.goerli_subtree_commit" */
  goerli_goerli_subtree_commit_stream: Array<Goerli_Goerli_Subtree_Commit>;
  /** fetch data from the table: "goerli.goerli_tree_insertion_event" */
  goerli_goerli_tree_insertion_event: Array<Goerli_Goerli_Tree_Insertion_Event>;
  /** fetch data from the table: "goerli.goerli_tree_insertion_event" using primary key columns */
  goerli_goerli_tree_insertion_event_by_pk?: Maybe<Goerli_Goerli_Tree_Insertion_Event>;
  /** fetch data from the table in a streaming manner: "goerli.goerli_tree_insertion_event" */
  goerli_goerli_tree_insertion_event_stream: Array<Goerli_Goerli_Tree_Insertion_Event>;
};


export type Subscription_RootGoerli_Goerli_Deposit_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Deposit_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Deposit_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Goerli_Deposit_Event_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Goerli_Deposit_Event_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Deposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Deposit_Request_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Request_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Deposit_Request_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Goerli_Deposit_Request_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Goerli_Deposit_Request_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Goerli_Deposit_Request_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Sdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Sdk_Event_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Sdk_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Sdk_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Goerli_Sdk_Event_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Goerli_Sdk_Event_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Goerli_Sdk_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Subtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Subtree_Commit_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Subtree_Commit_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Subtree_Commit_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Goerli_Subtree_Commit_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Goerli_Subtree_Commit_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Goerli_Subtree_Commit_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Tree_Insertion_EventArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Goerli_Tree_Insertion_Event_Order_By>>;
  where?: InputMaybe<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>;
};


export type Subscription_RootGoerli_Goerli_Tree_Insertion_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Goerli_Tree_Insertion_Event_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Goerli_Tree_Insertion_Event_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Goerli_Tree_Insertion_Event_Bool_Exp>;
};

export type FetchLatestIndexedBlockQueryVariables = Exact<{ [key: string]: never; }>;


export type FetchLatestIndexedBlockQuery = { __typename?: 'query_root', goerli_goerli_sdk_event_aggregate: { __typename?: 'goerli_goerli_sdk_event_aggregate', aggregate?: { __typename?: 'goerli_goerli_sdk_event_aggregate_fields', max?: { __typename?: 'goerli_goerli_sdk_event_max_fields', block?: number | null } | null } | null } };

export type FetchSdkEventsQueryVariables = Exact<{
  from: Scalars['String']['input'];
  toBlock: Scalars['Int']['input'];
  limit: Scalars['Int']['input'];
}>;


export type FetchSdkEventsQuery = { __typename?: 'query_root', goerli_goerli_sdk_event: Array<{ __typename?: 'goerli_goerli_sdk_event', id: string, merkle_index?: any | null, encoded_note_encoded_asset_addr?: any | null, encoded_note_encoded_asset_id?: any | null, encoded_note_nonce?: any | null, encoded_note_owner_h1?: any | null, encoded_note_owner_h2?: any | null, encoded_note_value?: any | null, encrypted_note_ciphertext_bytes?: any | null, encrypted_note_commitment?: any | null, encrypted_note_encapsulated_secret_bytes?: any | null, nullifier?: any | null }>, goerli_goerli_subtree_commit: Array<{ __typename?: 'goerli_goerli_subtree_commit', subtree_batch_offset: any }> };


export const FetchLatestIndexedBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"fetchLatestIndexedBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"goerli_goerli_sdk_event_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"block"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FetchLatestIndexedBlockQuery, FetchLatestIndexedBlockQueryVariables>;
export const FetchSdkEventsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"fetchSdkEvents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toBlock"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"goerli_goerli_sdk_event"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_gte"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"block"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_lt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toBlock"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"merkle_index"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_encoded_asset_addr"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_encoded_asset_id"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_nonce"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_owner_h1"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_owner_h2"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_note_value"}},{"kind":"Field","name":{"kind":"Name","value":"encrypted_note_ciphertext_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"encrypted_note_commitment"}},{"kind":"Field","name":{"kind":"Name","value":"encrypted_note_encapsulated_secret_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"nullifier"}}]}},{"kind":"Field","name":{"kind":"Name","value":"goerli_goerli_subtree_commit"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"block"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_lt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toBlock"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"desc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subtree_batch_offset"}}]}}]}}]} as unknown as DocumentNode<FetchSdkEventsQuery, FetchSdkEventsQueryVariables>;