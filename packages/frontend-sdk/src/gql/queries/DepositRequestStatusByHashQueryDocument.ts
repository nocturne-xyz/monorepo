import { graphql } from "../autogenerated";

export const DepositRequestStatusByHashQueryDocument = graphql(`
  query fetchDepositRequest($hash: ID!) {
    depositRequest(id: $hash) {
      status
    }
  }
`);