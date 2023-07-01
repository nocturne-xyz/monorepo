<!--
Thank you for your Pull Request. Please provide a description above and review
the requirements below. Bug fixes and new features should include tests.
-->

## Motivation

<!--
Explain the context and why you're making that change. What is the problem
you're trying to solve? In some cases there is not a problem and this can be
thought of as being the motivation for your change.
-->

## Solution

<!--
Summarize the solution and provide any necessary context needed to understand
the code change.
-->

## Proof

<!--
If features/changes is hard to test e2e, include a video or image proving you've
tested your solution and it works.
-->

## PR Checklist

- [ ] Added Tests
- [ ] Updated Documentation
- [ ] Updated CHANGELOG.md for the appropriate package
- [ ] Tested in dev/testnet
- [ ] Tested site with snap (we haven't automated this yet)
- [ ] Re-built & tested circuits if any of them changed

If you published snap, ensure you:
- [ ] ran `yarn clean && yarn build` first
- [ ] set hardcoded environment, including:
  - [ ] RPC URL
  - [ ] Subgraph URL
  - [ ] Bundler URL
  - [ ] config name
