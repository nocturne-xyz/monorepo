### Changesets

We use changesets for changelogs and versioning. See their docs for more information. In particular:
- For adding changesets (99% of the time), see [this](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)
- for a general explanation of changesets, what they do, and how they work, see [this](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md) and [this](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).

### How to add a changeset

Whenever you make a PR a package, you need to first determine:
1. whether or not the change requires a changeset. Typically, anything that changes functionality in a non-trivial way or anything you'd want to add to the changelog should have a changeset.
2. if you do need a changeset, then determine what kind of version bump it should represent, according to semver rules:
> Given a version number MAJOR.MINOR.PATCH, increment the:
>  MAJOR version when you make incompatible API changes
>  MINOR version when you add functionality in a backward compatible manner
>  PATCH version when you make backward compatible bug fixes
3. run `yarn changeset` from the monorepo root and follow the prompts. It will ask you:
  1. what packages to apply the changeset to
  2. which of those packages should get a major, minor, or patch bump
  3. text describing the change to go into the changelog when the changes are later released

This will create a file with a random-looking name in `./changeset` containing the list of packages, the version bump kind (major, minor, or patch), and the changelog text.

### Releasing

Over time, as PRs are merged, changesets will accumulate in `.changest/`. When we're ready to do a release, we currently:
1. pullc
2. run `yarn changeset version` to apply the changesets. This wiill remove all of the "random-looking" files in `./changeset`, apply their changelog entries to all of the respective package's changelogs, and increment the version numbers in `package.json`s. This will not publish any packages
3. open a release PR containing these changes and review them to make sure they're right (dependencies are right version and we're not breaking semver rules)
4. once you're sure it's correct, run `yarn publish-packages` to publish all of the packages that need to be published.
5. merge the PR

### Publishing to npm

Before publishing any package to `npm`, check the following:
1. there are no unapplied changesets. This can be checked by running `changeset status`.
2. all "meaningful" changes have changesets included in their package's respective changeset
3. versions follow proper semver, and you're using a preview tag (e.g. `alpha`) if necessary
4. ensure that changelogs were only modified using `yarn changeset version`

Then, run `yarn publish-packages` from the monorepo root. It will check for unapplied changesets, do a clean build, run unit tests, run integration tests, and then actually publish the packages.
