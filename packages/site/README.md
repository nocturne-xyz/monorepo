# Nocturne Power User Frontend 

To use:
1. run `yarn dev:site` in monorepo root
2. open `localhost:8000` in a browser
3. find ABI of a contract you like that's been deployed to your local hardhat node and paste it into the ABI text field
4. paste the contract's address into the contract address field
5. press "set ABI" to set the contract. This will create a form containing that contract's methods
6. Specify the tokens / amounts you will unwrap during this operation
7. Specify the tokens you will receive refunds in during this operation
8. enqueue actions by filling out the form for the methods you want to call and pressing "enqueue action" in sequence
9. when you've enqueued all of your actions, pross "GO", which will prompt MM to ask to generate a proof
