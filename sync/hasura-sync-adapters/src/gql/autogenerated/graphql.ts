/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  bigint: { input: any; output: any };
  bytea: { input: any; output: any };
  numeric: { input: any; output: any };
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["Int"]["input"]>;
  _gt?: InputMaybe<Scalars["Int"]["input"]>;
  _gte?: InputMaybe<Scalars["Int"]["input"]>;
  _in?: InputMaybe<Array<Scalars["Int"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["Int"]["input"]>;
  _lte?: InputMaybe<Scalars["Int"]["input"]>;
  _neq?: InputMaybe<Scalars["Int"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["Int"]["input"]>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["String"]["input"]>;
  _gt?: InputMaybe<Scalars["String"]["input"]>;
  _gte?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars["String"]["input"]>;
  _in?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars["String"]["input"]>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars["String"]["input"]>;
  _lt?: InputMaybe<Scalars["String"]["input"]>;
  _lte?: InputMaybe<Scalars["String"]["input"]>;
  _neq?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars["String"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["String"]["input"]>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars["String"]["input"]>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars["String"]["input"]>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["bigint"]["input"]>;
  _gt?: InputMaybe<Scalars["bigint"]["input"]>;
  _gte?: InputMaybe<Scalars["bigint"]["input"]>;
  _in?: InputMaybe<Array<Scalars["bigint"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["bigint"]["input"]>;
  _lte?: InputMaybe<Scalars["bigint"]["input"]>;
  _neq?: InputMaybe<Scalars["bigint"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["bigint"]["input"]>>;
};

/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
export type Bytea_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["bytea"]["input"]>;
  _gt?: InputMaybe<Scalars["bytea"]["input"]>;
  _gte?: InputMaybe<Scalars["bytea"]["input"]>;
  _in?: InputMaybe<Array<Scalars["bytea"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["bytea"]["input"]>;
  _lte?: InputMaybe<Scalars["bytea"]["input"]>;
  _neq?: InputMaybe<Scalars["bytea"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["bytea"]["input"]>>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = "ASC",
  /** descending ordering of the cursor */
  Desc = "DESC",
}

/** columns and relationships of "deposit_request" */
export type Deposit_Request = {
  __typename?: "deposit_request";
  _gs_chain?: Maybe<Scalars["String"]["output"]>;
  _gs_gid: Scalars["String"]["output"];
  block_range: Scalars["String"]["output"];
  completion_tx_hash?: Maybe<Scalars["bytea"]["output"]>;
  created_at_total_entity_index: Scalars["numeric"]["output"];
  deposit_addr_h1: Scalars["numeric"]["output"];
  deposit_addr_h2: Scalars["numeric"]["output"];
  encoded_asset_addr: Scalars["numeric"]["output"];
  encoded_asset_id: Scalars["numeric"]["output"];
  gas_compensation: Scalars["numeric"]["output"];
  id: Scalars["String"]["output"];
  instantiation_tx_hash: Scalars["bytea"]["output"];
  nonce: Scalars["numeric"]["output"];
  note_merkle_index?: Maybe<Scalars["numeric"]["output"]>;
  retrieval_tx_hash?: Maybe<Scalars["bytea"]["output"]>;
  spender: Scalars["bytea"]["output"];
  status: Scalars["String"]["output"];
  value: Scalars["numeric"]["output"];
  vid: Scalars["bigint"]["output"];
};

/** Boolean expression to filter rows from the table "deposit_request". All fields are combined with a logical 'AND'. */
export type Deposit_Request_Bool_Exp = {
  _and?: InputMaybe<Array<Deposit_Request_Bool_Exp>>;
  _gs_chain?: InputMaybe<String_Comparison_Exp>;
  _gs_gid?: InputMaybe<String_Comparison_Exp>;
  _not?: InputMaybe<Deposit_Request_Bool_Exp>;
  _or?: InputMaybe<Array<Deposit_Request_Bool_Exp>>;
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
  GsChain = "_gs_chain",
  /** column name */
  GsGid = "_gs_gid",
  /** column name */
  BlockRange = "block_range",
  /** column name */
  CompletionTxHash = "completion_tx_hash",
  /** column name */
  CreatedAtTotalEntityIndex = "created_at_total_entity_index",
  /** column name */
  DepositAddrH1 = "deposit_addr_h1",
  /** column name */
  DepositAddrH2 = "deposit_addr_h2",
  /** column name */
  EncodedAssetAddr = "encoded_asset_addr",
  /** column name */
  EncodedAssetId = "encoded_asset_id",
  /** column name */
  GasCompensation = "gas_compensation",
  /** column name */
  Id = "id",
  /** column name */
  InstantiationTxHash = "instantiation_tx_hash",
  /** column name */
  Nonce = "nonce",
  /** column name */
  NoteMerkleIndex = "note_merkle_index",
  /** column name */
  RetrievalTxHash = "retrieval_tx_hash",
  /** column name */
  Spender = "spender",
  /** column name */
  Status = "status",
  /** column name */
  Value = "value",
  /** column name */
  Vid = "vid",
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
  _gs_chain?: InputMaybe<Scalars["String"]["input"]>;
  _gs_gid?: InputMaybe<Scalars["String"]["input"]>;
  block_range?: InputMaybe<Scalars["String"]["input"]>;
  completion_tx_hash?: InputMaybe<Scalars["bytea"]["input"]>;
  created_at_total_entity_index?: InputMaybe<Scalars["numeric"]["input"]>;
  deposit_addr_h1?: InputMaybe<Scalars["numeric"]["input"]>;
  deposit_addr_h2?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_asset_addr?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_asset_id?: InputMaybe<Scalars["numeric"]["input"]>;
  gas_compensation?: InputMaybe<Scalars["numeric"]["input"]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  instantiation_tx_hash?: InputMaybe<Scalars["bytea"]["input"]>;
  nonce?: InputMaybe<Scalars["numeric"]["input"]>;
  note_merkle_index?: InputMaybe<Scalars["numeric"]["input"]>;
  retrieval_tx_hash?: InputMaybe<Scalars["bytea"]["input"]>;
  spender?: InputMaybe<Scalars["bytea"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
  value?: InputMaybe<Scalars["numeric"]["input"]>;
  vid?: InputMaybe<Scalars["bigint"]["input"]>;
};

/** Boolean expression to compare columns of type "numeric". All fields are combined with logical 'AND'. */
export type Numeric_Comparison_Exp = {
  _eq?: InputMaybe<Scalars["numeric"]["input"]>;
  _gt?: InputMaybe<Scalars["numeric"]["input"]>;
  _gte?: InputMaybe<Scalars["numeric"]["input"]>;
  _in?: InputMaybe<Array<Scalars["numeric"]["input"]>>;
  _is_null?: InputMaybe<Scalars["Boolean"]["input"]>;
  _lt?: InputMaybe<Scalars["numeric"]["input"]>;
  _lte?: InputMaybe<Scalars["numeric"]["input"]>;
  _neq?: InputMaybe<Scalars["numeric"]["input"]>;
  _nin?: InputMaybe<Array<Scalars["numeric"]["input"]>>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = "asc",
  /** in ascending order, nulls first */
  AscNullsFirst = "asc_nulls_first",
  /** in ascending order, nulls last */
  AscNullsLast = "asc_nulls_last",
  /** in descending order, nulls first */
  Desc = "desc",
  /** in descending order, nulls first */
  DescNullsFirst = "desc_nulls_first",
  /** in descending order, nulls last */
  DescNullsLast = "desc_nulls_last",
}

export type Query_Root = {
  __typename?: "query_root";
  /** fetch data from the table: "deposit_request" */
  deposit_request: Array<Deposit_Request>;
  /** fetch data from the table: "deposit_request" using primary key columns */
  deposit_request_by_pk?: Maybe<Deposit_Request>;
  /** fetch data from the table: "sdk_event" */
  sdk_event: Array<Sdk_Event>;
  /** fetch data from the table: "sdk_event" using primary key columns */
  sdk_event_by_pk?: Maybe<Sdk_Event>;
  /** fetch data from the table: "subtree_commit" */
  subtree_commit: Array<Subtree_Commit>;
  /** fetch data from the table: "subtree_commit" using primary key columns */
  subtree_commit_by_pk?: Maybe<Subtree_Commit>;
};

export type Query_RootDeposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Deposit_Request_Order_By>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};

export type Query_RootDeposit_Request_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

export type Query_RootSdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};

export type Query_RootSdk_Event_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

export type Query_RootSubtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};

export type Query_RootSubtree_Commit_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

/** columns and relationships of "sdk_event" */
export type Sdk_Event = {
  __typename?: "sdk_event";
  _gs_chain?: Maybe<Scalars["String"]["output"]>;
  _gs_gid: Scalars["String"]["output"];
  block: Scalars["Int"]["output"];
  encoded_note_encoded_asset_addr?: Maybe<Scalars["numeric"]["output"]>;
  encoded_note_encoded_asset_id?: Maybe<Scalars["numeric"]["output"]>;
  encoded_note_nonce?: Maybe<Scalars["numeric"]["output"]>;
  encoded_note_owner_h1?: Maybe<Scalars["numeric"]["output"]>;
  encoded_note_owner_h2?: Maybe<Scalars["numeric"]["output"]>;
  encoded_note_value?: Maybe<Scalars["numeric"]["output"]>;
  encrypted_note_ciphertext_bytes?: Maybe<Scalars["bytea"]["output"]>;
  encrypted_note_commitment?: Maybe<Scalars["numeric"]["output"]>;
  encrypted_note_encapsulated_secret_bytes?: Maybe<Scalars["bytea"]["output"]>;
  id: Scalars["String"]["output"];
  merkle_index?: Maybe<Scalars["numeric"]["output"]>;
  nullifier?: Maybe<Scalars["numeric"]["output"]>;
  vid: Scalars["bigint"]["output"];
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
  GsChain = "_gs_chain",
  /** column name */
  GsGid = "_gs_gid",
  /** column name */
  Block = "block",
  /** column name */
  EncodedNoteEncodedAssetAddr = "encoded_note_encoded_asset_addr",
  /** column name */
  EncodedNoteEncodedAssetId = "encoded_note_encoded_asset_id",
  /** column name */
  EncodedNoteNonce = "encoded_note_nonce",
  /** column name */
  EncodedNoteOwnerH1 = "encoded_note_owner_h1",
  /** column name */
  EncodedNoteOwnerH2 = "encoded_note_owner_h2",
  /** column name */
  EncodedNoteValue = "encoded_note_value",
  /** column name */
  EncryptedNoteCiphertextBytes = "encrypted_note_ciphertext_bytes",
  /** column name */
  EncryptedNoteCommitment = "encrypted_note_commitment",
  /** column name */
  EncryptedNoteEncapsulatedSecretBytes = "encrypted_note_encapsulated_secret_bytes",
  /** column name */
  Id = "id",
  /** column name */
  MerkleIndex = "merkle_index",
  /** column name */
  Nullifier = "nullifier",
  /** column name */
  Vid = "vid",
}

/** Streaming cursor of the table "sdk_event" */
export type Sdk_Event_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Sdk_Event_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Sdk_Event_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars["String"]["input"]>;
  _gs_gid?: InputMaybe<Scalars["String"]["input"]>;
  block?: InputMaybe<Scalars["Int"]["input"]>;
  encoded_note_encoded_asset_addr?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_note_encoded_asset_id?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_note_nonce?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_note_owner_h1?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_note_owner_h2?: InputMaybe<Scalars["numeric"]["input"]>;
  encoded_note_value?: InputMaybe<Scalars["numeric"]["input"]>;
  encrypted_note_ciphertext_bytes?: InputMaybe<Scalars["bytea"]["input"]>;
  encrypted_note_commitment?: InputMaybe<Scalars["numeric"]["input"]>;
  encrypted_note_encapsulated_secret_bytes?: InputMaybe<
    Scalars["bytea"]["input"]
  >;
  id?: InputMaybe<Scalars["String"]["input"]>;
  merkle_index?: InputMaybe<Scalars["numeric"]["input"]>;
  nullifier?: InputMaybe<Scalars["numeric"]["input"]>;
  vid?: InputMaybe<Scalars["bigint"]["input"]>;
};

export type Subscription_Root = {
  __typename?: "subscription_root";
  /** fetch data from the table: "deposit_request" */
  deposit_request: Array<Deposit_Request>;
  /** fetch data from the table: "deposit_request" using primary key columns */
  deposit_request_by_pk?: Maybe<Deposit_Request>;
  /** fetch data from the table in a streaming manner: "deposit_request" */
  deposit_request_stream: Array<Deposit_Request>;
  /** fetch data from the table: "sdk_event" */
  sdk_event: Array<Sdk_Event>;
  /** fetch data from the table: "sdk_event" using primary key columns */
  sdk_event_by_pk?: Maybe<Sdk_Event>;
  /** fetch data from the table in a streaming manner: "sdk_event" */
  sdk_event_stream: Array<Sdk_Event>;
  /** fetch data from the table: "subtree_commit" */
  subtree_commit: Array<Subtree_Commit>;
  /** fetch data from the table: "subtree_commit" using primary key columns */
  subtree_commit_by_pk?: Maybe<Subtree_Commit>;
  /** fetch data from the table in a streaming manner: "subtree_commit" */
  subtree_commit_stream: Array<Subtree_Commit>;
};

export type Subscription_RootDeposit_RequestArgs = {
  distinct_on?: InputMaybe<Array<Deposit_Request_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Deposit_Request_Order_By>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};

export type Subscription_RootDeposit_Request_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

export type Subscription_RootDeposit_Request_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Deposit_Request_Stream_Cursor_Input>>;
  where?: InputMaybe<Deposit_Request_Bool_Exp>;
};

export type Subscription_RootSdk_EventArgs = {
  distinct_on?: InputMaybe<Array<Sdk_Event_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Sdk_Event_Order_By>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};

export type Subscription_RootSdk_Event_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

export type Subscription_RootSdk_Event_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Sdk_Event_Stream_Cursor_Input>>;
  where?: InputMaybe<Sdk_Event_Bool_Exp>;
};

export type Subscription_RootSubtree_CommitArgs = {
  distinct_on?: InputMaybe<Array<Subtree_Commit_Select_Column>>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  order_by?: InputMaybe<Array<Subtree_Commit_Order_By>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};

export type Subscription_RootSubtree_Commit_By_PkArgs = {
  _gs_gid: Scalars["String"]["input"];
};

export type Subscription_RootSubtree_Commit_StreamArgs = {
  batch_size: Scalars["Int"]["input"];
  cursor: Array<InputMaybe<Subtree_Commit_Stream_Cursor_Input>>;
  where?: InputMaybe<Subtree_Commit_Bool_Exp>;
};

/** columns and relationships of "subtree_commit" */
export type Subtree_Commit = {
  __typename?: "subtree_commit";
  _gs_chain?: Maybe<Scalars["String"]["output"]>;
  _gs_gid: Scalars["String"]["output"];
  block: Scalars["Int"]["output"];
  id: Scalars["String"]["output"];
  new_root: Scalars["numeric"]["output"];
  subtree_batch_offset: Scalars["numeric"]["output"];
  vid: Scalars["bigint"]["output"];
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
  GsChain = "_gs_chain",
  /** column name */
  GsGid = "_gs_gid",
  /** column name */
  Block = "block",
  /** column name */
  Id = "id",
  /** column name */
  NewRoot = "new_root",
  /** column name */
  SubtreeBatchOffset = "subtree_batch_offset",
  /** column name */
  Vid = "vid",
}

/** Streaming cursor of the table "subtree_commit" */
export type Subtree_Commit_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Subtree_Commit_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Subtree_Commit_Stream_Cursor_Value_Input = {
  _gs_chain?: InputMaybe<Scalars["String"]["input"]>;
  _gs_gid?: InputMaybe<Scalars["String"]["input"]>;
  block?: InputMaybe<Scalars["Int"]["input"]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  new_root?: InputMaybe<Scalars["numeric"]["input"]>;
  subtree_batch_offset?: InputMaybe<Scalars["numeric"]["input"]>;
  vid?: InputMaybe<Scalars["bigint"]["input"]>;
};

export type FetchSdkEventsQueryVariables = Exact<{
  from: Scalars["String"]["input"];
  toBlock: Scalars["Int"]["input"];
  limit: Scalars["Int"]["input"];
}>;

export type FetchSdkEventsQuery = {
  __typename?: "query_root";
  sdk_event: Array<{
    __typename?: "sdk_event";
    id: string;
    merkle_index?: any | null;
    encoded_note_encoded_asset_addr?: any | null;
    encoded_note_encoded_asset_id?: any | null;
    encoded_note_nonce?: any | null;
    encoded_note_owner_h1?: any | null;
    encoded_note_owner_h2?: any | null;
    encoded_note_value?: any | null;
    encrypted_note_ciphertext_bytes?: any | null;
    encrypted_note_commitment?: any | null;
    encrypted_note_encapsulated_secret_bytes?: any | null;
    nullifier?: any | null;
  }>;
  subtree_commit: Array<{
    __typename?: "subtree_commit";
    subtree_batch_offset: any;
  }>;
};

export const FetchSdkEventsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "fetchSdkEvents" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "from" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "toBlock" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "limit" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sdk_event" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "where" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "id" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "_gte" },
                            value: {
                              kind: "Variable",
                              name: { kind: "Name", value: "from" },
                            },
                          },
                        ],
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "block" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "_lt" },
                            value: {
                              kind: "Variable",
                              name: { kind: "Name", value: "toBlock" },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "order_by" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "id" },
                      value: { kind: "EnumValue", value: "asc" },
                    },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "limit" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "merkle_index" },
                },
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "encoded_note_encoded_asset_addr",
                  },
                },
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "encoded_note_encoded_asset_id",
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "encoded_note_nonce" },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "encoded_note_owner_h1" },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "encoded_note_owner_h2" },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "encoded_note_value" },
                },
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "encrypted_note_ciphertext_bytes",
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "encrypted_note_commitment" },
                },
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "encrypted_note_encapsulated_secret_bytes",
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "nullifier" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "subtree_commit" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "where" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "block" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "_lt" },
                            value: {
                              kind: "Variable",
                              name: { kind: "Name", value: "toBlock" },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "order_by" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "id" },
                      value: { kind: "EnumValue", value: "desc" },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "subtree_batch_offset" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FetchSdkEventsQuery, FetchSdkEventsQueryVariables>;
