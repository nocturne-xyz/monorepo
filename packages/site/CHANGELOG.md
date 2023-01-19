# Changelog

### Unreleased

- Add genAndSubmitProofs button
- Add back old test site
- Add bundler endpoint to cofig
- Remove cross-env
- add ABI form
- Instantiate local prover on page load with `useEffect`
- Import `frontend-sdk` for calling snap and remove all snap utils
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- `ffjavascript` resolution removed, so proof gen works now
- Proof generation is broken due to yarn workspace incompatibilities with ffjavascript fork (to fix in next PR)
- Start `site` package and expose ability to sync notes, sync leaves, and generate proof for a hardcoded operation request
