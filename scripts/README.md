## `install_base_deps.sh`

Installs some deps needed if you're on a mac:

- homebrew
- GNU sed

## `build_docker.sh`

builds docker containers for offchain actors

`build_docker.sh` takes the following options:

- `-p` (optional): prover mode for subtree updater, `mock` or `rapidsnark`. Defaults to `mock`.
- `-o` (optional): only build the specified actor. can be `'bundler`, `deposit-screener`, `subtree-updater`, or `test-actor`.

This can be invoked from yarn via `yarn build:docker`, with args following.
For example, to build just the subtree updater with the rapidsnark prover, run `yarn build:docker -p radidsnark -o subtree-updater`

## `push_docker.sh`

pushes docker containers for offchain actors. You must be signed into docker (i.e. `docker login`) and have access to the `nocturnelabs` organization to be able to run this.

`push_docker.sh` takes the following options:
- `-o` (optional): only push the specified actor. can be `'bundler`, `deposit-screener`, `subtree-updater`, or `test-actor`.


### example

`yarn prepare:docker -p radisnark`

## `dev.sh`

spins up a local instance of nocturne, including a hardhat node, subgraph, contracts, and offchain actors.

You should never have to invoke this directly. Instead, you should simply run `yarn dev`


### Quirks

- if you are using an M1 mac, please check [the M1 doc](../M1_README.md) - it probably wont work until you go through the steps listed there.
- make sure you clean the DB after each fresh invocation of `yarn dev:site`. Not doing this can cause the snap to appear broken.

## `rebuild_graph_m1.sh`

Re-builds the graph targeting arm64 instead of x86. This is necessary for M1 users to be able to run it without it crashing.
