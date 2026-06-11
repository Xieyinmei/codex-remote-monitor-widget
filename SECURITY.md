# Security Policy

## Supported Versions

Security fixes target the latest version on the default branch until formal releases are created.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability that exposes credentials, host data, or local account information.

Until a dedicated security contact is configured, report privately through GitHub's private vulnerability reporting feature if available on the repository.

## Credential Handling

- SSH passwords are encrypted with Electron `safeStorage`.
- The app does not intentionally store plaintext passwords.
- Do not include real app data files, logs, screenshots, or host fingerprints in public bug reports.

## Scope

Relevant security issues include:

- plaintext credential storage
- renderer access to Node.js or Electron internals
- unsafe command construction for SSH commands
- leaking Codex account/quota data
- unsafe update or packaging behavior
