## `install_base_deps.sh`

Installs some deps needed if you're on a mac:
 - homebrew
 - GNU sed

##  `prepare_docker.sh`

builds docker containers for offchain actors.
takes the following options:
  - `-p` (optional): prover mode for subtree updater, 'mock' or 'rapidsnark'. Defaults to 'mock'.

This can be invoked from yarn via `yarn prepare:docker`.

### example

`yarn prepare:docker -p radisnark`

## `run_site_dev.sh`

Spins up the entire protocol, test site, and MetaMask snap locally.

This can be invoked from yarn via `yarn dev:site`.

After it finishes starting up, test site will be hosted at `localhost:4000`.

### site script quirks

- if you are using an M1 mac, please check [the M1 doc](../M1_README.md) - it probably wont work until you go through the steps listed there.
- if the bundler code has changed, it'll probably take a minute or so for the bundler to spin up, so if you immediately open the site and try to submit an op, you might get an error saying `ECONN_REFUSED` or something like that.
- make sure you clean the DB after each fresh invocation of `yarn dev:site`. Not doing this can cause the snap to appear broken.


## `rebuild_graph_m1.sh`

Re-builds the graph targeting arm64 instead of x86. This is necessary for M1 users to be able to run it without it crashing.

