# Security Policy

## Supported Versions

We currently support only the latest released version of WebSSH2 with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 2.5.x   | :white_check_mark: |
| < 2.5.0 | :x:                |

**We strongly recommend always using the latest release to ensure you have the most recent security patches and improvements.**

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by:

**GitHub Security Advisories**: Use the [Security Advisories](https://github.com/billchurch/WebSSH2/security/advisories) feature to privately report vulnerabilities

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability (e.g., authentication bypass, injection, etc.)
- Step-by-step instructions to reproduce the issue
- Affected version(s)
- Potential impact of the vulnerability
- Suggested fix (if available)

### What to Expect

- **Initial Response**: You can expect an initial response within 72 hours acknowledging receipt of your report
- **Status Updates**: We will keep you informed of our progress as we investigate and address the issue
- **Timeline**: We aim to release a security patch within 30 days for confirmed vulnerabilities, depending on complexity
- **Credit**: If you wish, we will credit you in the security advisory and release notes (unless you prefer to remain anonymous)

### Security Best Practices

When deploying WebSSH2:

- Always use HTTPS/TLS in production environments
- Implement proper authentication mechanisms
- Follow the principle of least privilege for SSH access
- Keep Node.js and all dependencies up to date
- Review and follow security guidance in our [documentation](README.md)
- Use environment variables for sensitive configuration (see [ENV_VARIABLES.md](DOCS/ENV_VARIABLES.md))

## Security Disclosure Policy

- **Private Disclosure**: We request that you give us reasonable time to address the issue before public disclosure
- **Coordinated Disclosure**: We will coordinate with you on the disclosure timeline
- **Public Advisory**: Once a fix is released, we will publish a security advisory detailing the vulnerability, the fix, and assigning credit.

Thank you for helping keep WebSSH2 and its users secure!

## Shai-hulud 2.0 supply chain risk

As of 2025-12-03, automated checks for Shai-hulud 2.0 indicators of compromise (IoCs) found **no evidence of compromise** in this repository.

The scanner performed the following checks:

- Searched for risky npm lifecycle scripts (preinstall, postinstall)
- Checked for known Shai-hulud 2.0 payload files (setup_bun.js, bun_environment.js)
- Inspected GitHub Actions workflows for discussion-triggered backdoor patterns and secret-dumping jobs
- Searched for known self-hosted runner and Docker breakout markers
- Checked for leaked cloud credentials and unsafe npm token usage
- Compared dependencies against a supplied list of known compromised npm packages (if provided)

No matches were found. This is not a guarantee of safety, but it indicates that this project does not currently exhibit known Shai-hulud 2.0 patterns.

### Hardening against Shai-hulud-style attacks

Regardless of current status, this project aims to reduce supply chain risk through the following practices:

- Dependencies are pinned, with automated checks to avoid adopting very recent releases until they age out an organization-defined delay window.
- CI/CD tokens and cloud credentials follow least-privilege and short-lived patterns.
- GitHub Actions workflows are restricted to known, reviewed actions from trusted sources.
- Secret scanning is enabled for this repository.
- npm lifecycle scripts are avoided where possible and are never used to download and execute remote code.
- Cloud IAM policies are configured so that developer or CI credentials cannot directly access production infrastructure.

For more information about detection logic or mitigations, contact the security team via [GitHub Security Advisories](https://github.com/billchurch/WebSSH2/security/advisories).

---

**Last updated:** 2025-12-03

**Next review:** 2026-01-03
