### Changesets

We use changesets for changelogs and versioning. See their docs for more information. In particular:
- For adding changesets (99% of the time), see [this](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)
- for a general explanation of changesets, what they do, and how they work, see [this](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md) and [this](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).

### Publishing to npm

Before publishing any package to `npm`, check the following:
1. there are no unapplied changesets. This can be checked by running `changeset status`.
2. all "meaningful" changes have changesets included in their package's respective changeset
3. versions follow proper semver, and you're using a preview tag (e.g. `alpha`) if necessary
4. ensure that changelogs were only modified using `yarn changeset version`

Then, run `yarn publish-packages` from the monorepo root. It will check for unapplied changesets, do a clean build, run unit tests, run integration tests, and then actually publish the packages.
