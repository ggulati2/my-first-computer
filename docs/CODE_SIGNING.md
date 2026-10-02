# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

## What is signed

Only the Windows files that Keybo's own release pipeline builds from this repository:

- `Keybo-Setup-<version>.exe` (the installer)
- `Keybo.exe` inside `Keybo-<version>-windows-portable.zip`

Nothing else is signed with this certificate: no third-party programs, and nothing built outside the pipeline.
Signing starts with the first release after SignPath Foundation approves the project; earlier releases are unsigned.

## How a release is built and signed

1. A version tag (`v1.2.3`) on a commit on `main` starts the public [release workflow](../.github/workflows/release.yml)
   on GitHub Actions. It first runs every check and test.
2. The apps are built from that tagged commit only, with the exact Python packages and hashes in `requirements.lock`.
3. The Windows files go to SignPath for signing. **Every signing request is approved by hand** by the approver
   below. Nothing is signed automatically.
4. Every release file gets a checksum (`SHA256SUMS.txt`) and a signed build-provenance attestation, so anyone can
   check that it was built by this workflow from this repository:
   `gh attestation verify <file> --repo ggulati2/my-first-computer`

## Team roles

| Role | Who | What they do |
|---|---|---|
| Committers | [@ggulati2](https://github.com/ggulati2) | may change the code; `main` only changes through pull requests with all checks green |
| Reviewers | [@ggulati2](https://github.com/ggulati2) | review and merge every pull request, including all changes from outside contributors |
| Approvers | [@ggulati2](https://github.com/ggulati2) | approve each release and each signing request |

All team members use two-factor authentication on GitHub and SignPath.

## Privacy

Keybo does not send any information to other computers unless a parent explicitly sets up and turns on the optional
online helper. Even then it sends only a topic, the language, the letters a child already knows and (for the weekly
report) numbers, never a name or anything the child typed. Details: [Privacy](PRIVACY.md).

## Reporting a problem

If you think a signed file is not what it claims to be, please report it privately as described in
[SECURITY.md](../SECURITY.md).
