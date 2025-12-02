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
