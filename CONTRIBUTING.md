# Contributing to FXCRUX License Engine

## Propose a change

1. [Fork the repository](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo) and create a branch in your fork.
2. Make one focused change. Follow [AGENTS.md](AGENTS.md) and run the relevant checks from [README.md](README.md).
3. Open a pull request from your branch to the official repository's `main` branch. Use the template to describe the change, its reason, how you tested it, and any compatibility impact.
4. Add the public name or GitHub handle you would like listed in [CONTRIBUTORS.md](CONTRIBUTORS.md). Let the maintainer know if you prefer to omit public credit.
5. Address review feedback. Ali Davodi decides which changes to merge into the official project.

Discussion can use any language. The maintainer may help translate proposed changes. Keep documentation, comments, interface text, and other tracked content in English when the pull request is ready to merge.

Send suspected vulnerabilities through the private channel in [SECURITY.md](SECURITY.md). Contributions are governed by the [Apache-2.0 license](LICENSE).

## Maintainer review and releases

Review the requested behavior, test evidence, compatibility, and security implications before approving a pull request. Include credited contributors in the release notes when they opt in.

After the repository exists on GitHub, associate the CODEOWNERS email with the maintainer's account or replace it with the verified GitHub handle. Protect `main` with a branch ruleset that requires pull requests, code-owner approval, and successful CI. Limit bypass and write access to the maintainer. Set up controls on release tags as needed to keep official `v*` tags under maintainer control.

The maintainer chooses a reviewed commit on `main`, checks release notes and any artifacts, and publishes a GitHub Release from a version tag such as `v0.1.0`. The CI workflow builds and tests proposed changes. An approved pull request may be included with other changes in the next release.
