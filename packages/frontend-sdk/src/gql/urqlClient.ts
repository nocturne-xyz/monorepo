import { Client, fetchExchange } from "urql";
import { SUBGRAPH_URL } from "../utils";

const client = new Client({
  url: SUBGRAPH_URL,
  exchanges: [fetchExchange],
});

export const getUrqlClient = (): Client => client;
