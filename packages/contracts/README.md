# Nocturne Contracts

## How to Run Deploy Script Locally

1. Ensure the desired network has an entry in `hardhat.config.ts` networks section. You can simply copy an existing network object and replace the network name (key) and url env var.
2. Populate a `.env` file. `HARDHAT_NETWORK` should match the name of the network populated in `hardhat.config.ts`.
3. Run `yarn deploy` to run the script.
4. Check `contracts/deploys` for a new JSON file containing newly deployed addresses.

## How to Run Deploy Script Via Docker (coming soon)
