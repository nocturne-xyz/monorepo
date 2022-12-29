# Subtree Updater

## Rapidsnark tests

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
