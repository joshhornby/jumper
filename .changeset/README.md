# Changesets

This folder holds changesets: one Markdown file for each change that a user of `jumper-cli` will notice.

Run `bun changeset` to add one. Choose the bump (`patch`, `minor` or `major`) and write one or two sentences for the changelog. Commit the file with your change.

When changesets reach `main`, the release workflow opens a "Version Packages" pull request. Merge it to publish to npm.
