import { CodegenConfig } from "@graphql-codegen/cli";

const SUBGRAPH_URL = "https://immune-bunny-99.hasura.app/v1/graphql";

const config: CodegenConfig = {
  schema: SUBGRAPH_URL,
  documents: ["src/gql/queries.ts"],
  ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    "./src/gql/autogenerated/": {
      preset: "client",
    },
  },
};

export default config;
