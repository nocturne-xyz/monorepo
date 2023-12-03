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

/** columns and relationships of "deposit_request" */
export type Deposit_Request = {
  __typename?: 'deposit_request';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
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

/** Boolean expression to filter rows from the table "deposit_request". All fields are combined with a logical 'AND'. */
export type Deposit_Request_Bool_Exp = {
  _and?: InputMaybe<Array<Deposit_Request_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Deposit_Request_Bool_Exp>;
  _or?: InputMaybe<Array<Deposit_Request_Bool_Exp>>;
  actual_gas_paid?: InputMaybe<Numeric_Comparison_Exp>;
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

/** Ordering options when selecting data from "deposit_request". */
export type Deposit_Request_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  actual_gas_paid?: InputMaybe<Order_By>;
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

/** select columns of table "deposit_request" */
export enum Deposit_Request_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  ActualGasPaid = 'actual_gas_paid',
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

/** Streaming cursor of the table "deposit_request" */
export type Deposit_Request_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Deposit_Request_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Deposit_Request_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  actual_gas_paid?: InputMaybe<Scalars['numeric']['input']>;
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

/** columns and relationships of "goerli.deposit_requests" */
export type Goerli_Deposit_Requests = {
  __typename?: 'goerli_deposit_requests';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
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

/** aggregated selection of "goerli.deposit_requests" */
export type Goerli_Deposit_Requests_Aggregate = {
  __typename?: 'goerli_deposit_requests_aggregate';
  aggregate?: Maybe<Goerli_Deposit_Requests_Aggregate_Fields>;
  nodes: Array<Goerli_Deposit_Requests>;
};

/** aggregate fields of "goerli.deposit_requests" */
export type Goerli_Deposit_Requests_Aggregate_Fields = {
  __typename?: 'goerli_deposit_requests_aggregate_fields';
  avg?: Maybe<Goerli_Deposit_Requests_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Goerli_Deposit_Requests_Max_Fields>;
  min?: Maybe<Goerli_Deposit_Requests_Min_Fields>;
  stddev?: Maybe<Goerli_Deposit_Requests_Stddev_Fields>;
  stddev_pop?: Maybe<Goerli_Deposit_Requests_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Goerli_Deposit_Requests_Stddev_Samp_Fields>;
  sum?: Maybe<Goerli_Deposit_Requests_Sum_Fields>;
  var_pop?: Maybe<Goerli_Deposit_Requests_Var_Pop_Fields>;
  var_samp?: Maybe<Goerli_Deposit_Requests_Var_Samp_Fields>;
  variance?: Maybe<Goerli_Deposit_Requests_Variance_Fields>;
};


/** aggregate fields of "goerli.deposit_requests" */
export type Goerli_Deposit_Requests_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Goerli_Deposit_Requests_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Goerli_Deposit_Requests_Avg_Fields = {
  __typename?: 'goerli_deposit_requests_avg_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "goerli.deposit_requests". All fields are combined with a logical 'AND'. */
export type Goerli_Deposit_Requests_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Deposit_Requests_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Deposit_Requests_Bool_Exp>>;
  actual_gas_paid?: InputMaybe<Numeric_Comparison_Exp>;
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

/** aggregate max on columns */
export type Goerli_Deposit_Requests_Max_Fields = {
  __typename?: 'goerli_deposit_requests_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  block_range?: Maybe<Scalars['String']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Goerli_Deposit_Requests_Min_Fields = {
  __typename?: 'goerli_deposit_requests_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  block_range?: Maybe<Scalars['String']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "goerli.deposit_requests". */
export type Goerli_Deposit_Requests_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  actual_gas_paid?: InputMaybe<Order_By>;
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

/** select columns of table "goerli.deposit_requests" */
export enum Goerli_Deposit_Requests_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  ActualGasPaid = 'actual_gas_paid',
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

/** aggregate stddev on columns */
export type Goerli_Deposit_Requests_Stddev_Fields = {
  __typename?: 'goerli_deposit_requests_stddev_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Goerli_Deposit_Requests_Stddev_Pop_Fields = {
  __typename?: 'goerli_deposit_requests_stddev_pop_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Goerli_Deposit_Requests_Stddev_Samp_Fields = {
  __typename?: 'goerli_deposit_requests_stddev_samp_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "goerli_deposit_requests" */
export type Goerli_Deposit_Requests_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Deposit_Requests_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Deposit_Requests_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  actual_gas_paid?: InputMaybe<Scalars['numeric']['input']>;
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

/** aggregate sum on columns */
export type Goerli_Deposit_Requests_Sum_Fields = {
  __typename?: 'goerli_deposit_requests_sum_fields';
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Goerli_Deposit_Requests_Var_Pop_Fields = {
  __typename?: 'goerli_deposit_requests_var_pop_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Goerli_Deposit_Requests_Var_Samp_Fields = {
  __typename?: 'goerli_deposit_requests_var_samp_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Goerli_Deposit_Requests_Variance_Fields = {
  __typename?: 'goerli_deposit_requests_variance_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "goerli.sdk_events" */
export type Goerli_Sdk_Events = {
  __typename?: 'goerli_sdk_events';
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

/** aggregated selection of "goerli.sdk_events" */
export type Goerli_Sdk_Events_Aggregate = {
  __typename?: 'goerli_sdk_events_aggregate';
  aggregate?: Maybe<Goerli_Sdk_Events_Aggregate_Fields>;
  nodes: Array<Goerli_Sdk_Events>;
};

/** aggregate fields of "goerli.sdk_events" */
export type Goerli_Sdk_Events_Aggregate_Fields = {
  __typename?: 'goerli_sdk_events_aggregate_fields';
  avg?: Maybe<Goerli_Sdk_Events_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Goerli_Sdk_Events_Max_Fields>;
  min?: Maybe<Goerli_Sdk_Events_Min_Fields>;
  stddev?: Maybe<Goerli_Sdk_Events_Stddev_Fields>;
  stddev_pop?: Maybe<Goerli_Sdk_Events_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Goerli_Sdk_Events_Stddev_Samp_Fields>;
  sum?: Maybe<Goerli_Sdk_Events_Sum_Fields>;
  var_pop?: Maybe<Goerli_Sdk_Events_Var_Pop_Fields>;
  var_samp?: Maybe<Goerli_Sdk_Events_Var_Samp_Fields>;
  variance?: Maybe<Goerli_Sdk_Events_Variance_Fields>;
};


/** aggregate fields of "goerli.sdk_events" */
export type Goerli_Sdk_Events_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Goerli_Sdk_Events_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Goerli_Sdk_Events_Avg_Fields = {
  __typename?: 'goerli_sdk_events_avg_fields';
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

/** Boolean expression to filter rows from the table "goerli.sdk_events". All fields are combined with a logical 'AND'. */
export type Goerli_Sdk_Events_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Sdk_Events_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Sdk_Events_Bool_Exp>>;
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
export type Goerli_Sdk_Events_Max_Fields = {
  __typename?: 'goerli_sdk_events_max_fields';
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
export type Goerli_Sdk_Events_Min_Fields = {
  __typename?: 'goerli_sdk_events_min_fields';
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

/** Ordering options when selecting data from "goerli.sdk_events". */
export type Goerli_Sdk_Events_Order_By = {
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

/** select columns of table "goerli.sdk_events" */
export enum Goerli_Sdk_Events_Select_Column {
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
export type Goerli_Sdk_Events_Stddev_Fields = {
  __typename?: 'goerli_sdk_events_stddev_fields';
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
export type Goerli_Sdk_Events_Stddev_Pop_Fields = {
  __typename?: 'goerli_sdk_events_stddev_pop_fields';
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
export type Goerli_Sdk_Events_Stddev_Samp_Fields = {
  __typename?: 'goerli_sdk_events_stddev_samp_fields';
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

/** Streaming cursor of the table "goerli_sdk_events" */
export type Goerli_Sdk_Events_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Sdk_Events_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Sdk_Events_Stream_Cursor_Value_Input = {
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
export type Goerli_Sdk_Events_Sum_Fields = {
  __typename?: 'goerli_sdk_events_sum_fields';
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
export type Goerli_Sdk_Events_Var_Pop_Fields = {
  __typename?: 'goerli_sdk_events_var_pop_fields';
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
export type Goerli_Sdk_Events_Var_Samp_Fields = {
  __typename?: 'goerli_sdk_events_var_samp_fields';
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
export type Goerli_Sdk_Events_Variance_Fields = {
  __typename?: 'goerli_sdk_events_variance_fields';
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

/** columns and relationships of "goerli.subtree_commits" */
export type Goerli_Subtree_Commits = {
  __typename?: 'goerli_subtree_commits';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  new_root: Scalars['numeric']['output'];
  subtree_batch_offset: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** aggregated selection of "goerli.subtree_commits" */
export type Goerli_Subtree_Commits_Aggregate = {
  __typename?: 'goerli_subtree_commits_aggregate';
  aggregate?: Maybe<Goerli_Subtree_Commits_Aggregate_Fields>;
  nodes: Array<Goerli_Subtree_Commits>;
};

/** aggregate fields of "goerli.subtree_commits" */
export type Goerli_Subtree_Commits_Aggregate_Fields = {
  __typename?: 'goerli_subtree_commits_aggregate_fields';
  avg?: Maybe<Goerli_Subtree_Commits_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Goerli_Subtree_Commits_Max_Fields>;
  min?: Maybe<Goerli_Subtree_Commits_Min_Fields>;
  stddev?: Maybe<Goerli_Subtree_Commits_Stddev_Fields>;
  stddev_pop?: Maybe<Goerli_Subtree_Commits_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Goerli_Subtree_Commits_Stddev_Samp_Fields>;
  sum?: Maybe<Goerli_Subtree_Commits_Sum_Fields>;
  var_pop?: Maybe<Goerli_Subtree_Commits_Var_Pop_Fields>;
  var_samp?: Maybe<Goerli_Subtree_Commits_Var_Samp_Fields>;
  variance?: Maybe<Goerli_Subtree_Commits_Variance_Fields>;
};


/** aggregate fields of "goerli.subtree_commits" */
export type Goerli_Subtree_Commits_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Goerli_Subtree_Commits_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Goerli_Subtree_Commits_Avg_Fields = {
  __typename?: 'goerli_subtree_commits_avg_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "goerli.subtree_commits". All fields are combined with a logical 'AND'. */
export type Goerli_Subtree_Commits_Bool_Exp = {
  _and?: InputMaybe<Array<Goerli_Subtree_Commits_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
  _or?: InputMaybe<Array<Goerli_Subtree_Commits_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  new_root?: InputMaybe<Numeric_Comparison_Exp>;
  subtree_batch_offset?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** aggregate max on columns */
export type Goerli_Subtree_Commits_Max_Fields = {
  __typename?: 'goerli_subtree_commits_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Goerli_Subtree_Commits_Min_Fields = {
  __typename?: 'goerli_subtree_commits_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "goerli.subtree_commits". */
export type Goerli_Subtree_Commits_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  new_root?: InputMaybe<Order_By>;
  subtree_batch_offset?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "goerli.subtree_commits" */
export enum Goerli_Subtree_Commits_Select_Column {
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

/** aggregate stddev on columns */
export type Goerli_Subtree_Commits_Stddev_Fields = {
  __typename?: 'goerli_subtree_commits_stddev_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Goerli_Subtree_Commits_Stddev_Pop_Fields = {
  __typename?: 'goerli_subtree_commits_stddev_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Goerli_Subtree_Commits_Stddev_Samp_Fields = {
  __typename?: 'goerli_subtree_commits_stddev_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "goerli_subtree_commits" */
export type Goerli_Subtree_Commits_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Goerli_Subtree_Commits_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Goerli_Subtree_Commits_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  new_root?: InputMaybe<Scalars['numeric']['input']>;
  subtree_batch_offset?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** aggregate sum on columns */
export type Goerli_Subtree_Commits_Sum_Fields = {
  __typename?: 'goerli_subtree_commits_sum_fields';
  block?: Maybe<Scalars['Int']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Goerli_Subtree_Commits_Var_Pop_Fields = {
  __typename?: 'goerli_subtree_commits_var_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Goerli_Subtree_Commits_Var_Samp_Fields = {
  __typename?: 'goerli_subtree_commits_var_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Goerli_Subtree_Commits_Variance_Fields = {
  __typename?: 'goerli_subtree_commits_variance_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "mainnet.deposit_requests" */
export type Mainnet_Deposit_Requests = {
  __typename?: 'mainnet_deposit_requests';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
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

/** aggregated selection of "mainnet.deposit_requests" */
export type Mainnet_Deposit_Requests_Aggregate = {
  __typename?: 'mainnet_deposit_requests_aggregate';
  aggregate?: Maybe<Mainnet_Deposit_Requests_Aggregate_Fields>;
  nodes: Array<Mainnet_Deposit_Requests>;
};

/** aggregate fields of "mainnet.deposit_requests" */
export type Mainnet_Deposit_Requests_Aggregate_Fields = {
  __typename?: 'mainnet_deposit_requests_aggregate_fields';
  avg?: Maybe<Mainnet_Deposit_Requests_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Mainnet_Deposit_Requests_Max_Fields>;
  min?: Maybe<Mainnet_Deposit_Requests_Min_Fields>;
  stddev?: Maybe<Mainnet_Deposit_Requests_Stddev_Fields>;
  stddev_pop?: Maybe<Mainnet_Deposit_Requests_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Mainnet_Deposit_Requests_Stddev_Samp_Fields>;
  sum?: Maybe<Mainnet_Deposit_Requests_Sum_Fields>;
  var_pop?: Maybe<Mainnet_Deposit_Requests_Var_Pop_Fields>;
  var_samp?: Maybe<Mainnet_Deposit_Requests_Var_Samp_Fields>;
  variance?: Maybe<Mainnet_Deposit_Requests_Variance_Fields>;
};


/** aggregate fields of "mainnet.deposit_requests" */
export type Mainnet_Deposit_Requests_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Mainnet_Deposit_Requests_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Mainnet_Deposit_Requests_Avg_Fields = {
  __typename?: 'mainnet_deposit_requests_avg_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "mainnet.deposit_requests". All fields are combined with a logical 'AND'. */
export type Mainnet_Deposit_Requests_Bool_Exp = {
  _and?: InputMaybe<Array<Mainnet_Deposit_Requests_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
  _or?: InputMaybe<Array<Mainnet_Deposit_Requests_Bool_Exp>>;
  actual_gas_paid?: InputMaybe<Numeric_Comparison_Exp>;
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

/** aggregate max on columns */
export type Mainnet_Deposit_Requests_Max_Fields = {
  __typename?: 'mainnet_deposit_requests_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  block_range?: Maybe<Scalars['String']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Mainnet_Deposit_Requests_Min_Fields = {
  __typename?: 'mainnet_deposit_requests_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  block_range?: Maybe<Scalars['String']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "mainnet.deposit_requests". */
export type Mainnet_Deposit_Requests_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  actual_gas_paid?: InputMaybe<Order_By>;
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

/** select columns of table "mainnet.deposit_requests" */
export enum Mainnet_Deposit_Requests_Select_Column {
  /** column name */
  GsChain = '_gs_chain',
  /** column name */
  GsGid = '_gs_gid',
  /** column name */
  ActualGasPaid = 'actual_gas_paid',
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

/** aggregate stddev on columns */
export type Mainnet_Deposit_Requests_Stddev_Fields = {
  __typename?: 'mainnet_deposit_requests_stddev_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Mainnet_Deposit_Requests_Stddev_Pop_Fields = {
  __typename?: 'mainnet_deposit_requests_stddev_pop_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Mainnet_Deposit_Requests_Stddev_Samp_Fields = {
  __typename?: 'mainnet_deposit_requests_stddev_samp_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "mainnet_deposit_requests" */
export type Mainnet_Deposit_Requests_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Mainnet_Deposit_Requests_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Mainnet_Deposit_Requests_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  actual_gas_paid?: InputMaybe<Scalars['numeric']['input']>;
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

/** aggregate sum on columns */
export type Mainnet_Deposit_Requests_Sum_Fields = {
  __typename?: 'mainnet_deposit_requests_sum_fields';
  actual_gas_paid?: Maybe<Scalars['numeric']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h1?: Maybe<Scalars['numeric']['output']>;
  deposit_addr_h2?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_addr?: Maybe<Scalars['numeric']['output']>;
  encoded_asset_id?: Maybe<Scalars['numeric']['output']>;
  gas_compensation?: Maybe<Scalars['numeric']['output']>;
  nonce?: Maybe<Scalars['numeric']['output']>;
  note_merkle_index?: Maybe<Scalars['numeric']['output']>;
  value?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Mainnet_Deposit_Requests_Var_Pop_Fields = {
  __typename?: 'mainnet_deposit_requests_var_pop_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Mainnet_Deposit_Requests_Var_Samp_Fields = {
  __typename?: 'mainnet_deposit_requests_var_samp_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Mainnet_Deposit_Requests_Variance_Fields = {
  __typename?: 'mainnet_deposit_requests_variance_fields';
  actual_gas_paid?: Maybe<Scalars['Float']['output']>;
  created_at_total_entity_index?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h1?: Maybe<Scalars['Float']['output']>;
  deposit_addr_h2?: Maybe<Scalars['Float']['output']>;
  encoded_asset_addr?: Maybe<Scalars['Float']['output']>;
  encoded_asset_id?: Maybe<Scalars['Float']['output']>;
  gas_compensation?: Maybe<Scalars['Float']['output']>;
  nonce?: Maybe<Scalars['Float']['output']>;
  note_merkle_index?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "mainnet.sdk_events" */
export type Mainnet_Sdk_Events = {
  __typename?: 'mainnet_sdk_events';
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

/** aggregated selection of "mainnet.sdk_events" */
export type Mainnet_Sdk_Events_Aggregate = {
  __typename?: 'mainnet_sdk_events_aggregate';
  aggregate?: Maybe<Mainnet_Sdk_Events_Aggregate_Fields>;
  nodes: Array<Mainnet_Sdk_Events>;
};

/** aggregate fields of "mainnet.sdk_events" */
export type Mainnet_Sdk_Events_Aggregate_Fields = {
  __typename?: 'mainnet_sdk_events_aggregate_fields';
  avg?: Maybe<Mainnet_Sdk_Events_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Mainnet_Sdk_Events_Max_Fields>;
  min?: Maybe<Mainnet_Sdk_Events_Min_Fields>;
  stddev?: Maybe<Mainnet_Sdk_Events_Stddev_Fields>;
  stddev_pop?: Maybe<Mainnet_Sdk_Events_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Mainnet_Sdk_Events_Stddev_Samp_Fields>;
  sum?: Maybe<Mainnet_Sdk_Events_Sum_Fields>;
  var_pop?: Maybe<Mainnet_Sdk_Events_Var_Pop_Fields>;
  var_samp?: Maybe<Mainnet_Sdk_Events_Var_Samp_Fields>;
  variance?: Maybe<Mainnet_Sdk_Events_Variance_Fields>;
};


/** aggregate fields of "mainnet.sdk_events" */
export type Mainnet_Sdk_Events_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Mainnet_Sdk_Events_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Mainnet_Sdk_Events_Avg_Fields = {
  __typename?: 'mainnet_sdk_events_avg_fields';
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

/** Boolean expression to filter rows from the table "mainnet.sdk_events". All fields are combined with a logical 'AND'. */
export type Mainnet_Sdk_Events_Bool_Exp = {
  _and?: InputMaybe<Array<Mainnet_Sdk_Events_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
  _or?: InputMaybe<Array<Mainnet_Sdk_Events_Bool_Exp>>;
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
export type Mainnet_Sdk_Events_Max_Fields = {
  __typename?: 'mainnet_sdk_events_max_fields';
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
export type Mainnet_Sdk_Events_Min_Fields = {
  __typename?: 'mainnet_sdk_events_min_fields';
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

/** Ordering options when selecting data from "mainnet.sdk_events". */
export type Mainnet_Sdk_Events_Order_By = {
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

/** select columns of table "mainnet.sdk_events" */
export enum Mainnet_Sdk_Events_Select_Column {
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
export type Mainnet_Sdk_Events_Stddev_Fields = {
  __typename?: 'mainnet_sdk_events_stddev_fields';
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
export type Mainnet_Sdk_Events_Stddev_Pop_Fields = {
  __typename?: 'mainnet_sdk_events_stddev_pop_fields';
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
export type Mainnet_Sdk_Events_Stddev_Samp_Fields = {
  __typename?: 'mainnet_sdk_events_stddev_samp_fields';
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

/** Streaming cursor of the table "mainnet_sdk_events" */
export type Mainnet_Sdk_Events_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Mainnet_Sdk_Events_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Mainnet_Sdk_Events_Stream_Cursor_Value_Input = {
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
export type Mainnet_Sdk_Events_Sum_Fields = {
  __typename?: 'mainnet_sdk_events_sum_fields';
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
export type Mainnet_Sdk_Events_Var_Pop_Fields = {
  __typename?: 'mainnet_sdk_events_var_pop_fields';
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
export type Mainnet_Sdk_Events_Var_Samp_Fields = {
  __typename?: 'mainnet_sdk_events_var_samp_fields';
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
export type Mainnet_Sdk_Events_Variance_Fields = {
  __typename?: 'mainnet_sdk_events_variance_fields';
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

/** columns and relationships of "mainnet.subtree_commits" */
export type Mainnet_Subtree_Commits = {
  __typename?: 'mainnet_subtree_commits';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  new_root: Scalars['numeric']['output'];
  subtree_batch_offset: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** aggregated selection of "mainnet.subtree_commits" */
export type Mainnet_Subtree_Commits_Aggregate = {
  __typename?: 'mainnet_subtree_commits_aggregate';
  aggregate?: Maybe<Mainnet_Subtree_Commits_Aggregate_Fields>;
  nodes: Array<Mainnet_Subtree_Commits>;
};

/** aggregate fields of "mainnet.subtree_commits" */
export type Mainnet_Subtree_Commits_Aggregate_Fields = {
  __typename?: 'mainnet_subtree_commits_aggregate_fields';
  avg?: Maybe<Mainnet_Subtree_Commits_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Mainnet_Subtree_Commits_Max_Fields>;
  min?: Maybe<Mainnet_Subtree_Commits_Min_Fields>;
  stddev?: Maybe<Mainnet_Subtree_Commits_Stddev_Fields>;
  stddev_pop?: Maybe<Mainnet_Subtree_Commits_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Mainnet_Subtree_Commits_Stddev_Samp_Fields>;
  sum?: Maybe<Mainnet_Subtree_Commits_Sum_Fields>;
  var_pop?: Maybe<Mainnet_Subtree_Commits_Var_Pop_Fields>;
  var_samp?: Maybe<Mainnet_Subtree_Commits_Var_Samp_Fields>;
  variance?: Maybe<Mainnet_Subtree_Commits_Variance_Fields>;
};


/** aggregate fields of "mainnet.subtree_commits" */
export type Mainnet_Subtree_Commits_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Mainnet_Subtree_Commits_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Mainnet_Subtree_Commits_Avg_Fields = {
  __typename?: 'mainnet_subtree_commits_avg_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "mainnet.subtree_commits". All fields are combined with a logical 'AND'. */
export type Mainnet_Subtree_Commits_Bool_Exp = {
  _and?: InputMaybe<Array<Mainnet_Subtree_Commits_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
  _or?: InputMaybe<Array<Mainnet_Subtree_Commits_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  new_root?: InputMaybe<Numeric_Comparison_Exp>;
  subtree_batch_offset?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** aggregate max on columns */
export type Mainnet_Subtree_Commits_Max_Fields = {
  __typename?: 'mainnet_subtree_commits_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Mainnet_Subtree_Commits_Min_Fields = {
  __typename?: 'mainnet_subtree_commits_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "mainnet.subtree_commits". */
export type Mainnet_Subtree_Commits_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  new_root?: InputMaybe<Order_By>;
  subtree_batch_offset?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "mainnet.subtree_commits" */
export enum Mainnet_Subtree_Commits_Select_Column {
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

/** aggregate stddev on columns */
export type Mainnet_Subtree_Commits_Stddev_Fields = {
  __typename?: 'mainnet_subtree_commits_stddev_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Mainnet_Subtree_Commits_Stddev_Pop_Fields = {
  __typename?: 'mainnet_subtree_commits_stddev_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Mainnet_Subtree_Commits_Stddev_Samp_Fields = {
  __typename?: 'mainnet_subtree_commits_stddev_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "mainnet_subtree_commits" */
export type Mainnet_Subtree_Commits_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Mainnet_Subtree_Commits_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Mainnet_Subtree_Commits_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  new_root?: InputMaybe<Scalars['numeric']['input']>;
  subtree_batch_offset?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** aggregate sum on columns */
export type Mainnet_Subtree_Commits_Sum_Fields = {
  __typename?: 'mainnet_subtree_commits_sum_fields';
  block?: Maybe<Scalars['Int']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Mainnet_Subtree_Commits_Var_Pop_Fields = {
  __typename?: 'mainnet_subtree_commits_var_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Mainnet_Subtree_Commits_Var_Samp_Fields = {
  __typename?: 'mainnet_subtree_commits_var_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Mainnet_Subtree_Commits_Variance_Fields = {
  __typename?: 'mainnet_subtree_commits_variance_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
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
  /** fetch data from the table: "deposit_request" */
  deposit_request: Array<Deposit_Request>;
  /** fetch data from the table: "deposit_request" using primary key columns */
  deposit_request_by_pk?: Maybe<Deposit_Request>;
  /** fetch data from the table: "goerli.deposit_requests" */
  goerli_deposit_requests: Array<Goerli_Deposit_Requests>;
  /** fetch aggregated fields from the table: "goerli.deposit_requests" */
  goerli_deposit_requests_aggregate: Goerli_Deposit_Requests_Aggregate;
  /** fetch data from the table: "goerli.deposit_requests" using primary key columns */
  goerli_deposit_requests_by_pk?: Maybe<Goerli_Deposit_Requests>;
  /** fetch data from the table: "goerli.sdk_events" */
  goerli_sdk_events: Array<Goerli_Sdk_Events>;
  /** fetch aggregated fields from the table: "goerli.sdk_events" */
  goerli_sdk_events_aggregate: Goerli_Sdk_Events_Aggregate;
  /** fetch data from the table: "goerli.sdk_events" using primary key columns */
  goerli_sdk_events_by_pk?: Maybe<Goerli_Sdk_Events>;
  /** fetch data from the table: "goerli.subtree_commits" */
  goerli_subtree_commits: Array<Goerli_Subtree_Commits>;
  /** fetch aggregated fields from the table: "goerli.subtree_commits" */
  goerli_subtree_commits_aggregate: Goerli_Subtree_Commits_Aggregate;
  /** fetch data from the table: "goerli.subtree_commits" using primary key columns */
  goerli_subtree_commits_by_pk?: Maybe<Goerli_Subtree_Commits>;
  /** fetch data from the table: "mainnet.deposit_requests" */
  mainnet_deposit_requests: Array<Mainnet_Deposit_Requests>;
  /** fetch aggregated fields from the table: "mainnet.deposit_requests" */
  mainnet_deposit_requests_aggregate: Mainnet_Deposit_Requests_Aggregate;
  /** fetch data from the table: "mainnet.deposit_requests" using primary key columns */
  mainnet_deposit_requests_by_pk?: Maybe<Mainnet_Deposit_Requests>;
  /** fetch data from the table: "mainnet.sdk_events" */
  mainnet_sdk_events: Array<Mainnet_Sdk_Events>;
  /** fetch aggregated fields from the table: "mainnet.sdk_events" */
  mainnet_sdk_events_aggregate: Mainnet_Sdk_Events_Aggregate;
  /** fetch data from the table: "mainnet.sdk_events" using primary key columns */
  mainnet_sdk_events_by_pk?: Maybe<Mainnet_Sdk_Events>;
  /** fetch data from the table: "mainnet.subtree_commits" */
  mainnet_subtree_commits: Array<Mainnet_Subtree_Commits>;
  /** fetch aggregated fields from the table: "mainnet.subtree_commits" */
  mainnet_subtree_commits_aggregate: Mainnet_Subtree_Commits_Aggregate;
  /** fetch data from the table: "mainnet.subtree_commits" using primary key columns */
  mainnet_subtree_commits_by_pk?: Maybe<Mainnet_Subtree_Commits>;
  /** fetch data from the table: "sdk_event" */
  sdk_event: Array<Sdk_Event>;
  /** fetch aggregated fields from the table: "sdk_event" */
  sdk_event_aggregate: Sdk_Event_Aggregate;
  /** fetch data from the table: "sdk_event" using primary key columns */
  sdk_event_by_pk?: Maybe<Sdk_Event>;
  /** fetch data from the table: "subtree_commit" */
  subtree_commit: Array<Subtree_Commit>;
  /** fetch aggregated fields from the table: "subtree_commit" */
  subtree_commit_aggregate: Subtree_Commit_Aggregate;
  /** fetch data from the table: "subtree_commit" using primary key columns */
  subtree_commit_by_pk?: Maybe<Subtree_Commit>;
};


export type Query_RootDeposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Deposit_Request_Order_By>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};


export type Query_RootDeposit_Request_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Deposit_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
};


export type Query_RootGoerli_Deposit_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
};


export type Query_RootGoerli_Deposit_Requests_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Sdk_EventsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Sdk_Events_Order_By>>;
  where?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
};


export type Query_RootGoerli_Sdk_Events_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Sdk_Events_Order_By>>;
  where?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
};


export type Query_RootGoerli_Sdk_Events_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootGoerli_Subtree_CommitsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
};


export type Query_RootGoerli_Subtree_Commits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
};


export type Query_RootGoerli_Subtree_Commits_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootMainnet_Deposit_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
};


export type Query_RootMainnet_Deposit_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
};


export type Query_RootMainnet_Deposit_Requests_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootMainnet_Sdk_EventsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Sdk_Events_Order_By>>;
  where?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
};


export type Query_RootMainnet_Sdk_Events_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Sdk_Events_Order_By>>;
  where?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
};


export type Query_RootMainnet_Sdk_Events_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootMainnet_Subtree_CommitsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
};


export type Query_RootMainnet_Subtree_Commits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
};


export type Query_RootMainnet_Subtree_Commits_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootSdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};


export type Query_RootSdk_Event_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};


export type Query_RootSdk_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Query_RootSubtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};


export type Query_RootSubtree_Commit_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};


export type Query_RootSubtree_Commit_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};

/** columns and relationships of "sdk_event" */
export type Sdk_Event = {
  __typename?: 'sdk_event';
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

/** aggregated selection of "sdk_event" */
export type Sdk_Event_Aggregate = {
  __typename?: 'sdk_event_aggregate';
  aggregate?: Maybe<Sdk_Event_Aggregate_Fields>;
  nodes: Array<Sdk_Event>;
};

/** aggregate fields of "sdk_event" */
export type Sdk_Event_Aggregate_Fields = {
  __typename?: 'sdk_event_aggregate_fields';
  avg?: Maybe<Sdk_Event_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Sdk_Event_Max_Fields>;
  min?: Maybe<Sdk_Event_Min_Fields>;
  stddev?: Maybe<Sdk_Event_Stddev_Fields>;
  stddev_pop?: Maybe<Sdk_Event_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Sdk_Event_Stddev_Samp_Fields>;
  sum?: Maybe<Sdk_Event_Sum_Fields>;
  var_pop?: Maybe<Sdk_Event_Var_Pop_Fields>;
  var_samp?: Maybe<Sdk_Event_Var_Samp_Fields>;
  variance?: Maybe<Sdk_Event_Variance_Fields>;
};


/** aggregate fields of "sdk_event" */
export type Sdk_Event_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Sdk_Event_Avg_Fields = {
  __typename?: 'sdk_event_avg_fields';
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

/** Boolean expression to filter rows from the table "sdk_event". All fields are combined with a logical 'AND'. */
export type Sdk_Event_Bool_Exp = {
  _and?: InputMaybe<Array<Sdk_Event_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Sdk_Event_Bool_Exp>;
  _or?: InputMaybe<Array<Sdk_Event_Bool_Exp>>;
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
export type Sdk_Event_Max_Fields = {
  __typename?: 'sdk_event_max_fields';
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
export type Sdk_Event_Min_Fields = {
  __typename?: 'sdk_event_min_fields';
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

/** Ordering options when selecting data from "sdk_event". */
export type Sdk_Event_Order_By = {
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

/** select columns of table "sdk_event" */
export enum Sdk_Event_Select_Column {
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
export type Sdk_Event_Stddev_Fields = {
  __typename?: 'sdk_event_stddev_fields';
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
export type Sdk_Event_Stddev_Pop_Fields = {
  __typename?: 'sdk_event_stddev_pop_fields';
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
export type Sdk_Event_Stddev_Samp_Fields = {
  __typename?: 'sdk_event_stddev_samp_fields';
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

/** Streaming cursor of the table "sdk_event" */
export type Sdk_Event_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Sdk_Event_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Sdk_Event_Stream_Cursor_Value_Input = {
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
export type Sdk_Event_Sum_Fields = {
  __typename?: 'sdk_event_sum_fields';
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
export type Sdk_Event_Var_Pop_Fields = {
  __typename?: 'sdk_event_var_pop_fields';
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
export type Sdk_Event_Var_Samp_Fields = {
  __typename?: 'sdk_event_var_samp_fields';
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
export type Sdk_Event_Variance_Fields = {
  __typename?: 'sdk_event_variance_fields';
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

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "deposit_request" */
  deposit_request: Array<Deposit_Request>;
  /** fetch data from the table: "deposit_request" using primary key columns */
  deposit_request_by_pk?: Maybe<Deposit_Request>;
  /** fetch data from the table in a streaming manner: "deposit_request" */
  deposit_request_stream: Array<Deposit_Request>;
  /** fetch data from the table: "goerli.deposit_requests" */
  goerli_deposit_requests: Array<Goerli_Deposit_Requests>;
  /** fetch aggregated fields from the table: "goerli.deposit_requests" */
  goerli_deposit_requests_aggregate: Goerli_Deposit_Requests_Aggregate;
  /** fetch data from the table: "goerli.deposit_requests" using primary key columns */
  goerli_deposit_requests_by_pk?: Maybe<Goerli_Deposit_Requests>;
  /** fetch data from the table in a streaming manner: "goerli.deposit_requests" */
  goerli_deposit_requests_stream: Array<Goerli_Deposit_Requests>;
  /** fetch data from the table: "goerli.sdk_events" */
  goerli_sdk_events: Array<Goerli_Sdk_Events>;
  /** fetch aggregated fields from the table: "goerli.sdk_events" */
  goerli_sdk_events_aggregate: Goerli_Sdk_Events_Aggregate;
  /** fetch data from the table: "goerli.sdk_events" using primary key columns */
  goerli_sdk_events_by_pk?: Maybe<Goerli_Sdk_Events>;
  /** fetch data from the table in a streaming manner: "goerli.sdk_events" */
  goerli_sdk_events_stream: Array<Goerli_Sdk_Events>;
  /** fetch data from the table: "goerli.subtree_commits" */
  goerli_subtree_commits: Array<Goerli_Subtree_Commits>;
  /** fetch aggregated fields from the table: "goerli.subtree_commits" */
  goerli_subtree_commits_aggregate: Goerli_Subtree_Commits_Aggregate;
  /** fetch data from the table: "goerli.subtree_commits" using primary key columns */
  goerli_subtree_commits_by_pk?: Maybe<Goerli_Subtree_Commits>;
  /** fetch data from the table in a streaming manner: "goerli.subtree_commits" */
  goerli_subtree_commits_stream: Array<Goerli_Subtree_Commits>;
  /** fetch data from the table: "mainnet.deposit_requests" */
  mainnet_deposit_requests: Array<Mainnet_Deposit_Requests>;
  /** fetch aggregated fields from the table: "mainnet.deposit_requests" */
  mainnet_deposit_requests_aggregate: Mainnet_Deposit_Requests_Aggregate;
  /** fetch data from the table: "mainnet.deposit_requests" using primary key columns */
  mainnet_deposit_requests_by_pk?: Maybe<Mainnet_Deposit_Requests>;
  /** fetch data from the table in a streaming manner: "mainnet.deposit_requests" */
  mainnet_deposit_requests_stream: Array<Mainnet_Deposit_Requests>;
  /** fetch data from the table: "mainnet.sdk_events" */
  mainnet_sdk_events: Array<Mainnet_Sdk_Events>;
  /** fetch aggregated fields from the table: "mainnet.sdk_events" */
  mainnet_sdk_events_aggregate: Mainnet_Sdk_Events_Aggregate;
  /** fetch data from the table: "mainnet.sdk_events" using primary key columns */
  mainnet_sdk_events_by_pk?: Maybe<Mainnet_Sdk_Events>;
  /** fetch data from the table in a streaming manner: "mainnet.sdk_events" */
  mainnet_sdk_events_stream: Array<Mainnet_Sdk_Events>;
  /** fetch data from the table: "mainnet.subtree_commits" */
  mainnet_subtree_commits: Array<Mainnet_Subtree_Commits>;
  /** fetch aggregated fields from the table: "mainnet.subtree_commits" */
  mainnet_subtree_commits_aggregate: Mainnet_Subtree_Commits_Aggregate;
  /** fetch data from the table: "mainnet.subtree_commits" using primary key columns */
  mainnet_subtree_commits_by_pk?: Maybe<Mainnet_Subtree_Commits>;
  /** fetch data from the table in a streaming manner: "mainnet.subtree_commits" */
  mainnet_subtree_commits_stream: Array<Mainnet_Subtree_Commits>;
  /** fetch data from the table: "sdk_event" */
  sdk_event: Array<Sdk_Event>;
  /** fetch aggregated fields from the table: "sdk_event" */
  sdk_event_aggregate: Sdk_Event_Aggregate;
  /** fetch data from the table: "sdk_event" using primary key columns */
  sdk_event_by_pk?: Maybe<Sdk_Event>;
  /** fetch data from the table in a streaming manner: "sdk_event" */
  sdk_event_stream: Array<Sdk_Event>;
  /** fetch data from the table: "subtree_commit" */
  subtree_commit: Array<Subtree_Commit>;
  /** fetch aggregated fields from the table: "subtree_commit" */
  subtree_commit_aggregate: Subtree_Commit_Aggregate;
  /** fetch data from the table: "subtree_commit" using primary key columns */
  subtree_commit_by_pk?: Maybe<Subtree_Commit>;
  /** fetch data from the table in a streaming manner: "subtree_commit" */
  subtree_commit_stream: Array<Subtree_Commit>;
};


export type Subscription_RootDeposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Deposit_Request_Order_By>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};


export type Subscription_RootDeposit_Request_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootDeposit_Request_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Deposit_Request_Stream_Cursor_Input>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};


export type Subscription_RootGoerli_Deposit_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootGoerli_Deposit_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootGoerli_Deposit_Requests_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Deposit_Requests_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Deposit_Requests_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootGoerli_Sdk_EventsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Sdk_Events_Order_By>>;
  where?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootGoerli_Sdk_Events_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Sdk_Events_Order_By>>;
  where?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootGoerli_Sdk_Events_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Sdk_Events_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Sdk_Events_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootGoerli_Subtree_CommitsArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootGoerli_Subtree_Commits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Goerli_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Goerli_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootGoerli_Subtree_Commits_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootGoerli_Subtree_Commits_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Goerli_Subtree_Commits_Stream_Cursor_Input>>;
  where?: InputMaybe<Goerli_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootMainnet_Deposit_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootMainnet_Deposit_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Deposit_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Deposit_Requests_Order_By>>;
  where?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootMainnet_Deposit_Requests_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootMainnet_Deposit_Requests_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Mainnet_Deposit_Requests_Stream_Cursor_Input>>;
  where?: InputMaybe<Mainnet_Deposit_Requests_Bool_Exp>;
};


export type Subscription_RootMainnet_Sdk_EventsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Sdk_Events_Order_By>>;
  where?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootMainnet_Sdk_Events_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Sdk_Events_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Sdk_Events_Order_By>>;
  where?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootMainnet_Sdk_Events_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootMainnet_Sdk_Events_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Mainnet_Sdk_Events_Stream_Cursor_Input>>;
  where?: InputMaybe<Mainnet_Sdk_Events_Bool_Exp>;
};


export type Subscription_RootMainnet_Subtree_CommitsArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootMainnet_Subtree_Commits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mainnet_Subtree_Commits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mainnet_Subtree_Commits_Order_By>>;
  where?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootMainnet_Subtree_Commits_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootMainnet_Subtree_Commits_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Mainnet_Subtree_Commits_Stream_Cursor_Input>>;
  where?: InputMaybe<Mainnet_Subtree_Commits_Bool_Exp>;
};


export type Subscription_RootSdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};


export type Subscription_RootSdk_Event_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};


export type Subscription_RootSdk_Event_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootSdk_Event_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Sdk_Event_Stream_Cursor_Input>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};


export type Subscription_RootSubtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};


export type Subscription_RootSubtree_Commit_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};


export type Subscription_RootSubtree_Commit_By_PkArgs = {
  _gs_gid: Scalars['String']['input'];
};


export type Subscription_RootSubtree_Commit_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Subtree_Commit_Stream_Cursor_Input>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};

/** columns and relationships of "subtree_commit" */
export type Subtree_Commit = {
  __typename?: 'subtree_commit';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid: Scalars['String']['output'];
  block: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  new_root: Scalars['numeric']['output'];
  subtree_batch_offset: Scalars['numeric']['output'];
  vid: Scalars['bigint']['output'];
};

/** aggregated selection of "subtree_commit" */
export type Subtree_Commit_Aggregate = {
  __typename?: 'subtree_commit_aggregate';
  aggregate?: Maybe<Subtree_Commit_Aggregate_Fields>;
  nodes: Array<Subtree_Commit>;
};

/** aggregate fields of "subtree_commit" */
export type Subtree_Commit_Aggregate_Fields = {
  __typename?: 'subtree_commit_aggregate_fields';
  avg?: Maybe<Subtree_Commit_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Subtree_Commit_Max_Fields>;
  min?: Maybe<Subtree_Commit_Min_Fields>;
  stddev?: Maybe<Subtree_Commit_Stddev_Fields>;
  stddev_pop?: Maybe<Subtree_Commit_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Subtree_Commit_Stddev_Samp_Fields>;
  sum?: Maybe<Subtree_Commit_Sum_Fields>;
  var_pop?: Maybe<Subtree_Commit_Var_Pop_Fields>;
  var_samp?: Maybe<Subtree_Commit_Var_Samp_Fields>;
  variance?: Maybe<Subtree_Commit_Variance_Fields>;
};


/** aggregate fields of "subtree_commit" */
export type Subtree_Commit_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Subtree_Commit_Avg_Fields = {
  __typename?: 'subtree_commit_avg_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "subtree_commit". All fields are combined with a logical 'AND'. */
export type Subtree_Commit_Bool_Exp = {
  _and?: InputMaybe<Array<Subtree_Commit_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Subtree_Commit_Bool_Exp>;
  _or?: InputMaybe<Array<Subtree_Commit_Bool_Exp>>;
  block?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  new_root?: InputMaybe<Numeric_Comparison_Exp>;
  subtree_batch_offset?: InputMaybe<Numeric_Comparison_Exp>;
  vid?: InputMaybe<Bigint_Comparison_Exp>;
};

/** aggregate max on columns */
export type Subtree_Commit_Max_Fields = {
  __typename?: 'subtree_commit_max_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate min on columns */
export type Subtree_Commit_Min_Fields = {
  __typename?: 'subtree_commit_min_fields';
  _gs_chain?: Maybe<Scalars['String']['output']>;
  _gs_gid?: Maybe<Scalars['String']['output']>;
  block?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** Ordering options when selecting data from "subtree_commit". */
export type Subtree_Commit_Order_By = {
  _gs_chain?: InputMaybe<Order_By>;
  _gs_gid?: InputMaybe<Order_By>;
  block?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  new_root?: InputMaybe<Order_By>;
  subtree_batch_offset?: InputMaybe<Order_By>;
  vid?: InputMaybe<Order_By>;
};

/** select columns of table "subtree_commit" */
export enum Subtree_Commit_Select_Column {
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

/** aggregate stddev on columns */
export type Subtree_Commit_Stddev_Fields = {
  __typename?: 'subtree_commit_stddev_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Subtree_Commit_Stddev_Pop_Fields = {
  __typename?: 'subtree_commit_stddev_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Subtree_Commit_Stddev_Samp_Fields = {
  __typename?: 'subtree_commit_stddev_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "subtree_commit" */
export type Subtree_Commit_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Subtree_Commit_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Subtree_Commit_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars['String']['input']>;
  _gs_gid?: InputMaybe<Scalars['String']['input']>;
  block?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  new_root?: InputMaybe<Scalars['numeric']['input']>;
  subtree_batch_offset?: InputMaybe<Scalars['numeric']['input']>;
  vid?: InputMaybe<Scalars['bigint']['input']>;
};

/** aggregate sum on columns */
export type Subtree_Commit_Sum_Fields = {
  __typename?: 'subtree_commit_sum_fields';
  block?: Maybe<Scalars['Int']['output']>;
  new_root?: Maybe<Scalars['numeric']['output']>;
  subtree_batch_offset?: Maybe<Scalars['numeric']['output']>;
  vid?: Maybe<Scalars['bigint']['output']>;
};

/** aggregate var_pop on columns */
export type Subtree_Commit_Var_Pop_Fields = {
  __typename?: 'subtree_commit_var_pop_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Subtree_Commit_Var_Samp_Fields = {
  __typename?: 'subtree_commit_var_samp_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Subtree_Commit_Variance_Fields = {
  __typename?: 'subtree_commit_variance_fields';
  block?: Maybe<Scalars['Float']['output']>;
  new_root?: Maybe<Scalars['Float']['output']>;
  subtree_batch_offset?: Maybe<Scalars['Float']['output']>;
  vid?: Maybe<Scalars['Float']['output']>;
};

export type GoerliFetchDepositRequestsQueryVariables = Exact<{
  spender: Scalars['bytea']['input'];
}>;


export type GoerliFetchDepositRequestsQuery = { __typename?: 'query_root', goerli_deposit_requests: Array<{ __typename?: 'goerli_deposit_requests', status: string, encoded_asset_addr: any, encoded_asset_id: any, value: any, deposit_addr_h1: any, deposit_addr_h2: any, nonce: any, gas_compensation: any, instantiation_tx_hash: any, completion_tx_hash?: any | null, retrieval_tx_hash?: any | null, created_at_total_entity_index: any }> };

export type GoerliFetchDepositStatusQueryVariables = Exact<{
  hash: Scalars['String']['input'];
}>;


export type GoerliFetchDepositStatusQuery = { __typename?: 'query_root', goerli_deposit_requests: Array<{ __typename?: 'goerli_deposit_requests', status: string }> };

export type MainnetFetchDepositRequestsQueryVariables = Exact<{
  spender: Scalars['bytea']['input'];
}>;


export type MainnetFetchDepositRequestsQuery = { __typename?: 'query_root', mainnet_deposit_requests: Array<{ __typename?: 'mainnet_deposit_requests', status: string, encoded_asset_addr: any, encoded_asset_id: any, value: any, deposit_addr_h1: any, deposit_addr_h2: any, nonce: any, gas_compensation: any, instantiation_tx_hash: any, completion_tx_hash?: any | null, retrieval_tx_hash?: any | null, created_at_total_entity_index: any }> };

export type MainnetFetchDepositStatusQueryVariables = Exact<{
  hash: Scalars['String']['input'];
}>;


export type MainnetFetchDepositStatusQuery = { __typename?: 'query_root', mainnet_deposit_requests: Array<{ __typename?: 'mainnet_deposit_requests', status: string }> };


export const GoerliFetchDepositRequestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"goerliFetchDepositRequests"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"spender"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bytea"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"goerli_deposit_requests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"spender"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"spender"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_asset_addr"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_asset_id"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"deposit_addr_h1"}},{"kind":"Field","name":{"kind":"Name","value":"deposit_addr_h2"}},{"kind":"Field","name":{"kind":"Name","value":"nonce"}},{"kind":"Field","name":{"kind":"Name","value":"gas_compensation"}},{"kind":"Field","name":{"kind":"Name","value":"instantiation_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"completion_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"retrieval_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"created_at_total_entity_index"}}]}}]}}]} as unknown as DocumentNode<GoerliFetchDepositRequestsQuery, GoerliFetchDepositRequestsQueryVariables>;
export const GoerliFetchDepositStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"goerliFetchDepositStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"goerli_deposit_requests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hash"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<GoerliFetchDepositStatusQuery, GoerliFetchDepositStatusQueryVariables>;
export const MainnetFetchDepositRequestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"mainnetFetchDepositRequests"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"spender"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bytea"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mainnet_deposit_requests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"spender"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"spender"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_asset_addr"}},{"kind":"Field","name":{"kind":"Name","value":"encoded_asset_id"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"deposit_addr_h1"}},{"kind":"Field","name":{"kind":"Name","value":"deposit_addr_h2"}},{"kind":"Field","name":{"kind":"Name","value":"nonce"}},{"kind":"Field","name":{"kind":"Name","value":"gas_compensation"}},{"kind":"Field","name":{"kind":"Name","value":"instantiation_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"completion_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"retrieval_tx_hash"}},{"kind":"Field","name":{"kind":"Name","value":"created_at_total_entity_index"}}]}}]}}]} as unknown as DocumentNode<MainnetFetchDepositRequestsQuery, MainnetFetchDepositRequestsQueryVariables>;
export const MainnetFetchDepositStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"mainnetFetchDepositStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mainnet_deposit_requests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hash"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<MainnetFetchDepositStatusQuery, MainnetFetchDepositStatusQueryVariables>;