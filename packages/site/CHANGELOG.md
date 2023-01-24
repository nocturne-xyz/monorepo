# Changelog

### Unreleased

- Add `DepositForm` to power user site and have `NocturneFrontendSDK` take wallet and vault addresses
- Remove unused wallet contract connect methods from metamask.ts
- Fix regression with dev script not updating token address
- Clean up power user site
  - Add autosyncing display for wallet balances
  - Clean up form sizing and spacing
  - Change displays for enqueued actions and tokens to use nicer list
  - Make ABI form display selector for method names and only display input boxes for selected method
- Remove cross-env
- add ABI form
- Instantiate local prover on page load with `useEffect`
- Import `frontend-sdk` for calling snap and remove all snap utils
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- `ffjavascript` resolution removed, so proof gen works now
- Proof generation is broken due to yarn workspace incompatibilities with ffjavascript fork (to fix in next PR)
- Start `site` package and expose ability to sync notes, sync leaves, and generate proof for a hardcoded operation request
