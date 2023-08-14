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
  BigDecimal: { input: any; output: any; }
  BigInt: { input: any; output: any; }
  Bytes: { input: any; output: any; }
};

export type BlockChangedFilter = {
  number_gte: Scalars['Int']['input'];
};

export type Block_Height = {
  hash?: InputMaybe<Scalars['Bytes']['input']>;
  number?: InputMaybe<Scalars['Int']['input']>;
  number_gte?: InputMaybe<Scalars['Int']['input']>;
};

export type DepositEvent = {
  __typename?: 'DepositEvent';
  depositAddrH1: Scalars['BigInt']['output'];
  depositAddrH2: Scalars['BigInt']['output'];
  encodedAssetAddr: Scalars['BigInt']['output'];
  encodedAssetId: Scalars['BigInt']['output'];
  gasCompensation: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  nonce: Scalars['BigInt']['output'];
  spender: Scalars['Bytes']['output'];
  type: DepositEventType;
  value: Scalars['BigInt']['output'];
};

export enum DepositEventType {
  Instantiated = 'Instantiated',
  Processed = 'Processed',
  Retrieved = 'Retrieved'
}

export type DepositEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<DepositEvent_Filter>>>;
  depositAddrH1?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH1_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH2?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH2_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  gasCompensation?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_gt?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_gte?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  gasCompensation_lt?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_lte?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_not?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  nonce?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<DepositEvent_Filter>>>;
  spender?: InputMaybe<Scalars['Bytes']['input']>;
  spender_contains?: InputMaybe<Scalars['Bytes']['input']>;
  spender_gt?: InputMaybe<Scalars['Bytes']['input']>;
  spender_gte?: InputMaybe<Scalars['Bytes']['input']>;
  spender_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  spender_lt?: InputMaybe<Scalars['Bytes']['input']>;
  spender_lte?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  type?: InputMaybe<DepositEventType>;
  type_in?: InputMaybe<Array<DepositEventType>>;
  type_not?: InputMaybe<DepositEventType>;
  type_not_in?: InputMaybe<Array<DepositEventType>>;
  value?: InputMaybe<Scalars['BigInt']['input']>;
  value_gt?: InputMaybe<Scalars['BigInt']['input']>;
  value_gte?: InputMaybe<Scalars['BigInt']['input']>;
  value_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  value_lt?: InputMaybe<Scalars['BigInt']['input']>;
  value_lte?: InputMaybe<Scalars['BigInt']['input']>;
  value_not?: InputMaybe<Scalars['BigInt']['input']>;
  value_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum DepositEvent_OrderBy {
  DepositAddrH1 = 'depositAddrH1',
  DepositAddrH2 = 'depositAddrH2',
  EncodedAssetAddr = 'encodedAssetAddr',
  EncodedAssetId = 'encodedAssetId',
  GasCompensation = 'gasCompensation',
  Id = 'id',
  Nonce = 'nonce',
  Spender = 'spender',
  Type = 'type',
  Value = 'value'
}

export type DepositRequest = {
  __typename?: 'DepositRequest';
  completionTxHash?: Maybe<Scalars['Bytes']['output']>;
  createdAtTotalEntityIndex: Scalars['BigInt']['output'];
  depositAddrH1: Scalars['BigInt']['output'];
  depositAddrH2: Scalars['BigInt']['output'];
  encodedAssetAddr: Scalars['BigInt']['output'];
  encodedAssetId: Scalars['BigInt']['output'];
  gasCompensation: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  instantiationTxHash: Scalars['Bytes']['output'];
  nonce: Scalars['BigInt']['output'];
  retrievalTxHash?: Maybe<Scalars['Bytes']['output']>;
  spender: Scalars['Bytes']['output'];
  status: DepositRequestStatus;
  value: Scalars['BigInt']['output'];
};

export enum DepositRequestStatus {
  Completed = 'Completed',
  Pending = 'Pending',
  Retrieved = 'Retrieved'
}

export type DepositRequest_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<DepositRequest_Filter>>>;
  completionTxHash?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  completionTxHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  completionTxHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  createdAtTotalEntityIndex?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  createdAtTotalEntityIndex_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAtTotalEntityIndex_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH1?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH1_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH1_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH2?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_gt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_gte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  depositAddrH2_lt?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_lte?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_not?: InputMaybe<Scalars['BigInt']['input']>;
  depositAddrH2_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  gasCompensation?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_gt?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_gte?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  gasCompensation_lt?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_lte?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_not?: InputMaybe<Scalars['BigInt']['input']>;
  gasCompensation_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  instantiationTxHash?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  instantiationTxHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  instantiationTxHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  nonce?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<DepositRequest_Filter>>>;
  retrievalTxHash?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  retrievalTxHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  retrievalTxHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  spender?: InputMaybe<Scalars['Bytes']['input']>;
  spender_contains?: InputMaybe<Scalars['Bytes']['input']>;
  spender_gt?: InputMaybe<Scalars['Bytes']['input']>;
  spender_gte?: InputMaybe<Scalars['Bytes']['input']>;
  spender_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  spender_lt?: InputMaybe<Scalars['Bytes']['input']>;
  spender_lte?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  spender_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  status?: InputMaybe<DepositRequestStatus>;
  status_in?: InputMaybe<Array<DepositRequestStatus>>;
  status_not?: InputMaybe<DepositRequestStatus>;
  status_not_in?: InputMaybe<Array<DepositRequestStatus>>;
  value?: InputMaybe<Scalars['BigInt']['input']>;
  value_gt?: InputMaybe<Scalars['BigInt']['input']>;
  value_gte?: InputMaybe<Scalars['BigInt']['input']>;
  value_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  value_lt?: InputMaybe<Scalars['BigInt']['input']>;
  value_lte?: InputMaybe<Scalars['BigInt']['input']>;
  value_not?: InputMaybe<Scalars['BigInt']['input']>;
  value_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum DepositRequest_OrderBy {
  CompletionTxHash = 'completionTxHash',
  CreatedAtTotalEntityIndex = 'createdAtTotalEntityIndex',
  DepositAddrH1 = 'depositAddrH1',
  DepositAddrH2 = 'depositAddrH2',
  EncodedAssetAddr = 'encodedAssetAddr',
  EncodedAssetId = 'encodedAssetId',
  GasCompensation = 'gasCompensation',
  Id = 'id',
  InstantiationTxHash = 'instantiationTxHash',
  Nonce = 'nonce',
  RetrievalTxHash = 'retrievalTxHash',
  Spender = 'spender',
  Status = 'status',
  Value = 'value'
}

export type EncodedNote = {
  __typename?: 'EncodedNote';
  encodedAssetAddr: Scalars['BigInt']['output'];
  encodedAssetId: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  nonce: Scalars['BigInt']['output'];
  ownerH1: Scalars['BigInt']['output'];
  ownerH2: Scalars['BigInt']['output'];
  value: Scalars['BigInt']['output'];
};

export type EncodedNote_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<EncodedNote_Filter>>>;
  encodedAssetAddr?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  nonce?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  nonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<EncodedNote_Filter>>>;
  ownerH1?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_gt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_gte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH1_lt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_lte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_not?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH2?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_gt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_gte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH2_lt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_lte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_not?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  value?: InputMaybe<Scalars['BigInt']['input']>;
  value_gt?: InputMaybe<Scalars['BigInt']['input']>;
  value_gte?: InputMaybe<Scalars['BigInt']['input']>;
  value_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  value_lt?: InputMaybe<Scalars['BigInt']['input']>;
  value_lte?: InputMaybe<Scalars['BigInt']['input']>;
  value_not?: InputMaybe<Scalars['BigInt']['input']>;
  value_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum EncodedNote_OrderBy {
  EncodedAssetAddr = 'encodedAssetAddr',
  EncodedAssetId = 'encodedAssetId',
  Id = 'id',
  Nonce = 'nonce',
  OwnerH1 = 'ownerH1',
  OwnerH2 = 'ownerH2',
  Value = 'value'
}

export type EncodedOrEncryptedNote = {
  __typename?: 'EncodedOrEncryptedNote';
  encryptedNote?: Maybe<EncryptedNote>;
  id: Scalars['ID']['output'];
  merkleIndex: Scalars['BigInt']['output'];
  note?: Maybe<EncodedNote>;
};

export type EncodedOrEncryptedNote_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<EncodedOrEncryptedNote_Filter>>>;
  encryptedNote?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_?: InputMaybe<EncryptedNote_Filter>;
  encryptedNote_contains?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_ends_with?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_gt?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_gte?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encryptedNote_lt?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_lte?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_contains?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encryptedNote_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_starts_with?: InputMaybe<Scalars['String']['input']>;
  encryptedNote_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  merkleIndex?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_gt?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_gte?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  merkleIndex_lt?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_lte?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_not?: InputMaybe<Scalars['BigInt']['input']>;
  merkleIndex_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  note?: InputMaybe<Scalars['String']['input']>;
  note_?: InputMaybe<EncodedNote_Filter>;
  note_contains?: InputMaybe<Scalars['String']['input']>;
  note_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  note_ends_with?: InputMaybe<Scalars['String']['input']>;
  note_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  note_gt?: InputMaybe<Scalars['String']['input']>;
  note_gte?: InputMaybe<Scalars['String']['input']>;
  note_in?: InputMaybe<Array<Scalars['String']['input']>>;
  note_lt?: InputMaybe<Scalars['String']['input']>;
  note_lte?: InputMaybe<Scalars['String']['input']>;
  note_not?: InputMaybe<Scalars['String']['input']>;
  note_not_contains?: InputMaybe<Scalars['String']['input']>;
  note_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  note_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  note_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  note_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  note_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  note_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  note_starts_with?: InputMaybe<Scalars['String']['input']>;
  note_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  or?: InputMaybe<Array<InputMaybe<EncodedOrEncryptedNote_Filter>>>;
};

export enum EncodedOrEncryptedNote_OrderBy {
  EncryptedNote = 'encryptedNote',
  EncryptedNoteCommitment = 'encryptedNote__commitment',
  EncryptedNoteEncappedKey = 'encryptedNote__encappedKey',
  EncryptedNoteEncodedAssetAddr = 'encryptedNote__encodedAssetAddr',
  EncryptedNoteEncodedAssetId = 'encryptedNote__encodedAssetId',
  EncryptedNoteEncryptedNonce = 'encryptedNote__encryptedNonce',
  EncryptedNoteEncryptedValue = 'encryptedNote__encryptedValue',
  EncryptedNoteId = 'encryptedNote__id',
  EncryptedNoteOwnerH1 = 'encryptedNote__ownerH1',
  EncryptedNoteOwnerH2 = 'encryptedNote__ownerH2',
  Id = 'id',
  MerkleIndex = 'merkleIndex',
  Note = 'note',
  NoteEncodedAssetAddr = 'note__encodedAssetAddr',
  NoteEncodedAssetId = 'note__encodedAssetId',
  NoteId = 'note__id',
  NoteNonce = 'note__nonce',
  NoteOwnerH1 = 'note__ownerH1',
  NoteOwnerH2 = 'note__ownerH2',
  NoteValue = 'note__value'
}

export type EncryptedNote = {
  __typename?: 'EncryptedNote';
  commitment: Scalars['BigInt']['output'];
  encappedKey: Scalars['BigInt']['output'];
  encodedAssetAddr: Scalars['BigInt']['output'];
  encodedAssetId: Scalars['BigInt']['output'];
  encryptedNonce: Scalars['BigInt']['output'];
  encryptedValue: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  ownerH1: Scalars['BigInt']['output'];
  ownerH2: Scalars['BigInt']['output'];
};

export type EncryptedNote_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<EncryptedNote_Filter>>>;
  commitment?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_gt?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_gte?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  commitment_lt?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_lte?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_not?: InputMaybe<Scalars['BigInt']['input']>;
  commitment_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encappedKey?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encappedKey_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_not?: InputMaybe<Scalars['BigInt']['input']>;
  encappedKey_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetAddr_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetAddr_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encodedAssetId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not?: InputMaybe<Scalars['BigInt']['input']>;
  encodedAssetId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encryptedNonce?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encryptedNonce_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_not?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedNonce_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encryptedValue?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_gt?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_gte?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  encryptedValue_lt?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_lte?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_not?: InputMaybe<Scalars['BigInt']['input']>;
  encryptedValue_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<EncryptedNote_Filter>>>;
  ownerH1?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_gt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_gte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH1_lt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_lte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_not?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH1_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH2?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_gt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_gte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  ownerH2_lt?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_lte?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_not?: InputMaybe<Scalars['BigInt']['input']>;
  ownerH2_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum EncryptedNote_OrderBy {
  Commitment = 'commitment',
  EncappedKey = 'encappedKey',
  EncodedAssetAddr = 'encodedAssetAddr',
  EncodedAssetId = 'encodedAssetId',
  EncryptedNonce = 'encryptedNonce',
  EncryptedValue = 'encryptedValue',
  Id = 'id',
  OwnerH1 = 'ownerH1',
  OwnerH2 = 'ownerH2'
}

export type FilledBatchWithZerosEvent = {
  __typename?: 'FilledBatchWithZerosEvent';
  id: Scalars['ID']['output'];
  numZeros: Scalars['BigInt']['output'];
  startIndex: Scalars['BigInt']['output'];
};

export type FilledBatchWithZerosEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<FilledBatchWithZerosEvent_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  numZeros?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_gt?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_gte?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  numZeros_lt?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_lte?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_not?: InputMaybe<Scalars['BigInt']['input']>;
  numZeros_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<FilledBatchWithZerosEvent_Filter>>>;
  startIndex?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_gt?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_gte?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  startIndex_lt?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_lte?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_not?: InputMaybe<Scalars['BigInt']['input']>;
  startIndex_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum FilledBatchWithZerosEvent_OrderBy {
  Id = 'id',
  NumZeros = 'numZeros',
  StartIndex = 'startIndex'
}

export type Nullifier = {
  __typename?: 'Nullifier';
  id: Scalars['ID']['output'];
  nullifier: Scalars['BigInt']['output'];
};

export type Nullifier_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Nullifier_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  nullifier?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_gt?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_gte?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  nullifier_lt?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_lte?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_not?: InputMaybe<Scalars['BigInt']['input']>;
  nullifier_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Nullifier_Filter>>>;
};

export enum Nullifier_OrderBy {
  Id = 'id',
  Nullifier = 'nullifier'
}

/** Defines the order direction, either ascending or descending */
export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type Query = {
  __typename?: 'Query';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  depositEvent?: Maybe<DepositEvent>;
  depositEvents: Array<DepositEvent>;
  depositRequest?: Maybe<DepositRequest>;
  depositRequests: Array<DepositRequest>;
  encodedNote?: Maybe<EncodedNote>;
  encodedNotes: Array<EncodedNote>;
  encodedOrEncryptedNote?: Maybe<EncodedOrEncryptedNote>;
  encodedOrEncryptedNotes: Array<EncodedOrEncryptedNote>;
  encryptedNote?: Maybe<EncryptedNote>;
  encryptedNotes: Array<EncryptedNote>;
  filledBatchWithZerosEvent?: Maybe<FilledBatchWithZerosEvent>;
  filledBatchWithZerosEvents: Array<FilledBatchWithZerosEvent>;
  nullifier?: Maybe<Nullifier>;
  nullifiers: Array<Nullifier>;
  sdkevent?: Maybe<SdkEvent>;
  sdkevents: Array<SdkEvent>;
  subtreeCommit?: Maybe<SubtreeCommit>;
  subtreeCommits: Array<SubtreeCommit>;
  treeInsertionEvent?: Maybe<TreeInsertionEvent>;
  treeInsertionEvents: Array<TreeInsertionEvent>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryDepositEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryDepositEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DepositEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<DepositEvent_Filter>;
};


export type QueryDepositRequestArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryDepositRequestsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DepositRequest_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<DepositRequest_Filter>;
};


export type QueryEncodedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryEncodedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncodedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncodedNote_Filter>;
};


export type QueryEncodedOrEncryptedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryEncodedOrEncryptedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncodedOrEncryptedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncodedOrEncryptedNote_Filter>;
};


export type QueryEncryptedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryEncryptedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncryptedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncryptedNote_Filter>;
};


export type QueryFilledBatchWithZerosEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryFilledBatchWithZerosEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<FilledBatchWithZerosEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<FilledBatchWithZerosEvent_Filter>;
};


export type QueryNullifierArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryNullifiersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Nullifier_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Nullifier_Filter>;
};


export type QuerySdkeventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySdkeventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SdkEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SdkEvent_Filter>;
};


export type QuerySubtreeCommitArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySubtreeCommitsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SubtreeCommit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SubtreeCommit_Filter>;
};


export type QueryTreeInsertionEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryTreeInsertionEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TreeInsertionEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TreeInsertionEvent_Filter>;
};

export type SdkEvent = {
  __typename?: 'SDKEvent';
  encodedOrEncryptedNote?: Maybe<EncodedOrEncryptedNote>;
  filledBatchWithZerosUpToMerkleIndex?: Maybe<Scalars['BigInt']['output']>;
  id: Scalars['ID']['output'];
  nullifier?: Maybe<Nullifier>;
};

export type SdkEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<SdkEvent_Filter>>>;
  encodedOrEncryptedNote?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_?: InputMaybe<EncodedOrEncryptedNote_Filter>;
  encodedOrEncryptedNote_contains?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_ends_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_gt?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_gte?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encodedOrEncryptedNote_lt?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_lte?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_contains?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encodedOrEncryptedNote_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_starts_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosUpToMerkleIndex?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_gt?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_gte?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  filledBatchWithZerosUpToMerkleIndex_lt?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_lte?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_not?: InputMaybe<Scalars['BigInt']['input']>;
  filledBatchWithZerosUpToMerkleIndex_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  nullifier?: InputMaybe<Scalars['String']['input']>;
  nullifier_?: InputMaybe<Nullifier_Filter>;
  nullifier_contains?: InputMaybe<Scalars['String']['input']>;
  nullifier_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  nullifier_ends_with?: InputMaybe<Scalars['String']['input']>;
  nullifier_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  nullifier_gt?: InputMaybe<Scalars['String']['input']>;
  nullifier_gte?: InputMaybe<Scalars['String']['input']>;
  nullifier_in?: InputMaybe<Array<Scalars['String']['input']>>;
  nullifier_lt?: InputMaybe<Scalars['String']['input']>;
  nullifier_lte?: InputMaybe<Scalars['String']['input']>;
  nullifier_not?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_contains?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  nullifier_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  nullifier_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  nullifier_starts_with?: InputMaybe<Scalars['String']['input']>;
  nullifier_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  or?: InputMaybe<Array<InputMaybe<SdkEvent_Filter>>>;
};

export enum SdkEvent_OrderBy {
  EncodedOrEncryptedNote = 'encodedOrEncryptedNote',
  EncodedOrEncryptedNoteId = 'encodedOrEncryptedNote__id',
  EncodedOrEncryptedNoteMerkleIndex = 'encodedOrEncryptedNote__merkleIndex',
  FilledBatchWithZerosUpToMerkleIndex = 'filledBatchWithZerosUpToMerkleIndex',
  Id = 'id',
  Nullifier = 'nullifier',
  NullifierId = 'nullifier__id',
  NullifierNullifier = 'nullifier__nullifier'
}

export type Subscription = {
  __typename?: 'Subscription';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  depositEvent?: Maybe<DepositEvent>;
  depositEvents: Array<DepositEvent>;
  depositRequest?: Maybe<DepositRequest>;
  depositRequests: Array<DepositRequest>;
  encodedNote?: Maybe<EncodedNote>;
  encodedNotes: Array<EncodedNote>;
  encodedOrEncryptedNote?: Maybe<EncodedOrEncryptedNote>;
  encodedOrEncryptedNotes: Array<EncodedOrEncryptedNote>;
  encryptedNote?: Maybe<EncryptedNote>;
  encryptedNotes: Array<EncryptedNote>;
  filledBatchWithZerosEvent?: Maybe<FilledBatchWithZerosEvent>;
  filledBatchWithZerosEvents: Array<FilledBatchWithZerosEvent>;
  nullifier?: Maybe<Nullifier>;
  nullifiers: Array<Nullifier>;
  sdkevent?: Maybe<SdkEvent>;
  sdkevents: Array<SdkEvent>;
  subtreeCommit?: Maybe<SubtreeCommit>;
  subtreeCommits: Array<SubtreeCommit>;
  treeInsertionEvent?: Maybe<TreeInsertionEvent>;
  treeInsertionEvents: Array<TreeInsertionEvent>;
};


export type Subscription_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type SubscriptionDepositEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionDepositEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DepositEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<DepositEvent_Filter>;
};


export type SubscriptionDepositRequestArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionDepositRequestsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DepositRequest_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<DepositRequest_Filter>;
};


export type SubscriptionEncodedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionEncodedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncodedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncodedNote_Filter>;
};


export type SubscriptionEncodedOrEncryptedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionEncodedOrEncryptedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncodedOrEncryptedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncodedOrEncryptedNote_Filter>;
};


export type SubscriptionEncryptedNoteArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionEncryptedNotesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<EncryptedNote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<EncryptedNote_Filter>;
};


export type SubscriptionFilledBatchWithZerosEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionFilledBatchWithZerosEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<FilledBatchWithZerosEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<FilledBatchWithZerosEvent_Filter>;
};


export type SubscriptionNullifierArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionNullifiersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Nullifier_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Nullifier_Filter>;
};


export type SubscriptionSdkeventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSdkeventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SdkEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SdkEvent_Filter>;
};


export type SubscriptionSubtreeCommitArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSubtreeCommitsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SubtreeCommit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SubtreeCommit_Filter>;
};


export type SubscriptionTreeInsertionEventArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionTreeInsertionEventsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TreeInsertionEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TreeInsertionEvent_Filter>;
};

export type SubtreeCommit = {
  __typename?: 'SubtreeCommit';
  id: Scalars['ID']['output'];
  newRoot: Scalars['BigInt']['output'];
  subtreeBatchOffset: Scalars['BigInt']['output'];
};

export type SubtreeCommit_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<SubtreeCommit_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  newRoot?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_gt?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_gte?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  newRoot_lt?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_lte?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_not?: InputMaybe<Scalars['BigInt']['input']>;
  newRoot_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<SubtreeCommit_Filter>>>;
  subtreeBatchOffset?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_gt?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_gte?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  subtreeBatchOffset_lt?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_lte?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_not?: InputMaybe<Scalars['BigInt']['input']>;
  subtreeBatchOffset_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum SubtreeCommit_OrderBy {
  Id = 'id',
  NewRoot = 'newRoot',
  SubtreeBatchOffset = 'subtreeBatchOffset'
}

export type TreeInsertionEvent = {
  __typename?: 'TreeInsertionEvent';
  encodedOrEncryptedNote?: Maybe<EncodedOrEncryptedNote>;
  filledBatchWithZerosEvent?: Maybe<FilledBatchWithZerosEvent>;
  id: Scalars['ID']['output'];
};

export type TreeInsertionEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<TreeInsertionEvent_Filter>>>;
  encodedOrEncryptedNote?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_?: InputMaybe<EncodedOrEncryptedNote_Filter>;
  encodedOrEncryptedNote_contains?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_ends_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_gt?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_gte?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encodedOrEncryptedNote_lt?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_lte?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_contains?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  encodedOrEncryptedNote_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_starts_with?: InputMaybe<Scalars['String']['input']>;
  encodedOrEncryptedNote_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_?: InputMaybe<FilledBatchWithZerosEvent_Filter>;
  filledBatchWithZerosEvent_contains?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_ends_with?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_gt?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_gte?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filledBatchWithZerosEvent_lt?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_lte?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_contains?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  filledBatchWithZerosEvent_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_starts_with?: InputMaybe<Scalars['String']['input']>;
  filledBatchWithZerosEvent_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<TreeInsertionEvent_Filter>>>;
};

export enum TreeInsertionEvent_OrderBy {
  EncodedOrEncryptedNote = 'encodedOrEncryptedNote',
  EncodedOrEncryptedNoteId = 'encodedOrEncryptedNote__id',
  EncodedOrEncryptedNoteMerkleIndex = 'encodedOrEncryptedNote__merkleIndex',
  FilledBatchWithZerosEvent = 'filledBatchWithZerosEvent',
  FilledBatchWithZerosEventId = 'filledBatchWithZerosEvent__id',
  FilledBatchWithZerosEventNumZeros = 'filledBatchWithZerosEvent__numZeros',
  FilledBatchWithZerosEventStartIndex = 'filledBatchWithZerosEvent__startIndex',
  Id = 'id'
}

export type _Block_ = {
  __typename?: '_Block_';
  /** The hash of the block */
  hash?: Maybe<Scalars['Bytes']['output']>;
  /** The block number */
  number: Scalars['Int']['output'];
  /** Integer representation of the timestamp stored in blocks for the chain */
  timestamp?: Maybe<Scalars['Int']['output']>;
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  __typename?: '_Meta_';
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  block: _Block_;
  /** The deployment ID */
  deployment: Scalars['String']['output'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars['Boolean']['output'];
};

export enum _SubgraphErrorPolicy_ {
  /** Data will be returned even if the subgraph has indexing errors */
  Allow = 'allow',
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  Deny = 'deny'
}

export type FetchDepositRequestQueryVariables = Exact<{
  hash: Scalars['ID']['input'];
}>;


export type FetchDepositRequestQuery = { __typename?: 'Query', depositRequest?: { __typename?: 'DepositRequest', status: DepositRequestStatus } | null };

export type FetchDepositRequestsQueryVariables = Exact<{
  spender: Scalars['Bytes']['input'];
}>;


export type FetchDepositRequestsQuery = { __typename?: 'Query', depositRequests: Array<{ __typename?: 'DepositRequest', spender: any, status: DepositRequestStatus, encodedAssetAddr: any, encodedAssetId: any, value: any, depositAddrH1: any, depositAddrH2: any, nonce: any, gasCompensation: any, instantiationTxHash: any, completionTxHash?: any | null, retrievalTxHash?: any | null, createdAtTotalEntityIndex: any }> };


export const FetchDepositRequestDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"fetchDepositRequest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"depositRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hash"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<FetchDepositRequestQuery, FetchDepositRequestQueryVariables>;
export const FetchDepositRequestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"fetchDepositRequests"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"spender"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Bytes"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"depositRequests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"spender"},"value":{"kind":"Variable","name":{"kind":"Name","value":"spender"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spender"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"encodedAssetAddr"}},{"kind":"Field","name":{"kind":"Name","value":"encodedAssetId"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"depositAddrH1"}},{"kind":"Field","name":{"kind":"Name","value":"depositAddrH2"}},{"kind":"Field","name":{"kind":"Name","value":"nonce"}},{"kind":"Field","name":{"kind":"Name","value":"gasCompensation"}},{"kind":"Field","name":{"kind":"Name","value":"instantiationTxHash"}},{"kind":"Field","name":{"kind":"Name","value":"completionTxHash"}},{"kind":"Field","name":{"kind":"Name","value":"retrievalTxHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAtTotalEntityIndex"}}]}}]}}]} as unknown as DocumentNode<FetchDepositRequestsQuery, FetchDepositRequestsQueryVariables>;