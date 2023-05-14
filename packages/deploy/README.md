# Nocturne Deploy

## How to Run Deploy Script Locally

1. Populate a `.env` file according to `.env.example`.
2. Write a deploy config (not to be confused with *nocturne config* as defined in `@nocturne-xyz/configs`) file:
	1. choose a name `DEPLOYMENT_NAME`, e.g. `sepolia`. At the end of the deploy script, it will write a new *nocturne config* file called `${DEPLOYMENT_NAME}.json` to `./deploys/${DEPLOYMENT_NAME}.json`.
	2. add a file to the `configs` directory using `example.json` as an example, noting the following:
		* `protocolAllowlist` is the allowlist for "protocols" like Lido and Uniswap. `erc20s` is the allowlist for ERC-20 tokens. The difference between the two is that `protocolAllowlist` allows the specified address to be called from the `Handler`. But, in the event that it implements ERC-20, it doesn't allow it to be deposited in the `DepositManager`. If it's included in `erc20s`, it's allowlisted in both the `Handler` and the `DepositManager`. Therefore you should put all supported `erc20s` in `erc20s`, while non-token protocols should go in `protocolAllowList`
		* if you specify an entry in `erc20s` with an adreess of `0x0000000000000000000000000000000000000000`, the script will deploy a new token with `decimals = precision` and allowlist it. Its address will be populated in the resulting *nocturne config* in `./deploys`.
3. Run `yarn deploy` to run the script. You will see the deployment addresses logged to console.
4. Check the `deploys` directory for a new JSON file named ` containing newly deployed addresses.
