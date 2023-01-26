# Subtree Updater

## Running tests

By default, the rapidsnark prover's unit test is disabled. To enable them, set `USE_RAPIDSNARK` env var to `true`:
```bash
USE_RAPIDSNARK=true yarn test:unit
```

Additionally, by default, during tests the server is run with `MockSubtreeUpdateProver` off-chain and `TestSubtreeUpdateVerifier` in contract. To use a real prover / verifier, set the `ACTUALLY_PROVE_SUBTREE_UPDATE` env var to `true`:
```bash
ACTUALLY_PROVE_SUBTREE_UPDATE=true yarn test:e2e
```

You can combine the two too if you can run rapidsnark on your system:
```bash
ACTUALLY_PROVE_SUBTREE_UPDATE=true USE_RAPIDSNARK=true yarn test:e2e
```

## Running CLI

> Note: Because rapidsnark only compiles natively on x86 linux. Unless that's the OS/machine you're on, you'll probably need to run via docker instead.

1. run `npm i -g` from the package directory
2. Make a `.env` file containing `SUBMITTER_SECRET_KEY` in the `packages/subtree-updater`. See `.env.example` for the format.
  * you can get a test secret key by running `yarn hh-node` from `packages/e2e-tests` and picking one of the test keys it prints out.
3. run `subtree-updater-cli`, which will connect to an RPC node running at `localhost:8545`, specifying the following arguments:
	- `--wallet-address <address>`: address of the wallet contract
	- `--zkey-path <path>`: path to the subtree update circuit's proving key. In the monorepo, this is located at `circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey` after the circuit is built.
	- `--vkey-path <path>`: path to the subtree update circuit's verifying key. In the monorepo, this is located at `circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json` after the circuit is built.
	- `--prover-path <path>`: path to the rapidsnark prover exectuable. After building rapidsanrk in the submodule, this is located at `rapidsnark/build/prover`"
	- `--witness-generator-path <path>`: path to the C++ witness generator executable.  This can be built by running `make` in the `subtreeupdate_cpp` directory emitted by circom.

> Note: because the zkey is quite large, the built circuit isn't included in the repo by default, so you must manually build it by running `yarn build:subtreeupdate` in `packages/circuits`.

One can additionally pass in optional arguments:
- `--network <endpoint>`: connect to a different RPC node enpoint
- `--dbPath <path>`: persist state somewhere other than `./db` (the default)
- `--tmp-dir <path>`: write intermediate files from rapidsnark somewhere other than `./prover-tmp` (the default)

# Running from Docker

1. Build the docker image by running `yarn build:docker`. This will build the subtree update circuit and witness generator if it hasn't been built yet
  * this will take a while (on the order of 30-40 minutes) in the event that the circuit needs to be built.
  * if the circuit ever changes, you need to manually rebuild it by running `yarn build:subtreeupdate` in `packages/circuits`.
  * to build with the mock prover, run `yarn build:mock:docker`
2. Make a `.env` file containing `SUBMITTER_SECRET_KEY` in the `packages/subtree-updater`. See `.env.example` for the format.
  * you can get a test secret key by running `yarn hh-node` from `packages/e2e-tests` and picking one of the test keys it prints out.
3. Assuming you already have an RPC node running at `localhost:8545`, Run the container by running the following command from monorepo root:
```

docker run --platform=linux/amd64 --env-file ./packages/subtree-updater/.env --add-host host.docker.internal:host-gateway docker.io/library/mock-subtree-updater --use-mock-prover --wallet-address <WALLET_ADDRESS> --zkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey --vkey-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/vkey.json --prover-path /rapidsnark/build/prover --witness-generator-path ./circuit-artifacts/subtreeupdate/subtreeupdate_cpp/subtreeupdate --network http://host.docker.internal:8545
```

> We have to include the optional `--network` parameter to the CLI here because, in docker, we need to use the internal host gateway to connect to a process running outside the container. The `--add-host` option we're using with `docker run` tells docker to attach the gateway to the container (this is automatic on docker for mac and windows, but not linux).
