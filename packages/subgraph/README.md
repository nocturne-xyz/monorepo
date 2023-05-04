## Subgraph

### Building for a given network

by default, `yarn build` will build for the `mainnet` network specified in `networks.json`. To use a different one, use the graph CLI directly.

For example, to build for sepolia, `yarn graph build --network sepolia`

### Deploying to goldsky

Use the goldsky cli:

```
goldsky subgraph deploy nocturne/<VERSION>
```
