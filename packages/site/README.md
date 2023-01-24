# Nocturne Power User Frontend

### Usage

1. run `yarn dev:site` in monorepo root
2. open `localhost:8000` in a browser
3. Ensure MetaMask is properly setup (see details below)
4. find ABI of a contract you like that's been deployed to your local hardhat node and paste it into the ABI text field
5. paste the contract's address into the contract address field
6. press "set ABI" to set the contract. This will create a form containing that contract's methods
7. Specify the tokens / amounts you will unwrap during this operation
8. Specify the tokens you will receive refunds in during this operation
9. queue up actions by filling out the form for the methods you want to call and pressing "enqueue action" in sequence
10. when you've queued up all of your actions, press "GO", which will prompt MM to ask to generate a proof

### MetaMask Setup

We use hardhat node to run a local devnet. The caveat is that the chain ID for hardhat node is always 31377 (not overridable), which does not match MetaMask's localhost default of 1337. Thus you must create/use a MetaMask network entry with the following details:

- Network Name: hh-node
- New RPC URL: http://127.0.0.1:8545
- Chain ID: 31377
- Currency Symbol: GO
