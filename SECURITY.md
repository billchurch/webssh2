# Security Policy

## Supply Chain Security

### NPM Package Verification Process

WebSSH2 implements comprehensive security measures to protect against supply chain attacks, including the NPM package hijacking incident reported in September 2025.

#### Verification Status
✅ **VERIFIED SAFE** - This repository does not contain compromised packages from the September 2025 NPM supply chain attack.

#### Enhanced Security Measures

##### 1. Package Cool-Down Period
- **Policy**: 2-week quarantine for all newly released package versions
- **Process**: New versions only adopted after community vetting period  
- **Exception**: Critical security patches with CVE advisories

##### 2. Automated Security Scanning
```bash
# Run security checks
npm run security:check     # Check for compromised packages
npm run security:audit     # Run npm audit + recommend Trivy
npm run security:socket    # Instructions for Socket.dev scan
```

##### 3. Supply Chain Verification Tools
- **Socket.dev**: Real-time dependency risk analysis
- **Trivy**: Container and dependency vulnerability scanning
- **npm audit**: Built-in NPM security auditing
- **Package Integrity**: SRI hashes for critical dependencies

##### 4. CI/CD Security Pipeline
Our GitHub Actions workflow includes:
- Daily automated security scans
- Pre-commit package verification
- Dependency vulnerability checks
- Socket.dev integration for PR reviews

#### Locked Package Versions
The following packages are locked to safe versions via `overrides`:
```json
{
  "debug": "4.4.1"
}
```

### Reporting Security Vulnerabilities

Please report security vulnerabilities to:
- **Email**: security@webssh2.com (if available)
- **GitHub**: Create a private security advisory
- **Emergency**: Create a public issue with `security` label

### Security Response Timeline
- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours
- **Fix Development**: Within 1 week for critical issues
- **Public Disclosure**: After fix is deployed and users have time to update

### Security Best Practices for Contributors

1. **Never commit secrets** - Use environment variables
2. **Pin dependency versions** - Avoid automatic updates
3. **Review dependency updates** - Wait 2 weeks for new releases
4. **Run security checks** - Before every commit
5. **Update dependencies regularly** - But only after vetting period

### Dependency Management Policy

#### New Dependencies
1. Community vetting period (2 weeks minimum)
2. Security audit with Socket.dev and Trivy
3. Review of maintainer reputation and project health
4. Approval by security team

#### Updates
1. Review change logs for security implications
2. Wait 2 weeks after release (except security patches)
3. Automated testing in isolated environment
4. Manual verification before merging

### Security Tools Integration

#### Socket.dev
```bash
# Install Socket.dev CLI
npm install -g @socketsecurity/cli
# Scan project
socket.dev cli scan
```

#### Trivy
```bash
# Install Trivy (macOS)
brew install trivy
# Scan dependencies
trivy fs --security-checks vuln .
```

### References
- [NPM Supply Chain Attack - September 2025](https://www.bleepingcomputer.com/news/security/hackers-hijack-npm-packages-with-2-billion-weekly-downloads-in-supply-chain-attack/)
- [Socket.dev Security Platform](https://socket.dev)
- [Trivy Security Scanner](https://trivy.dev)
- [NPM Security Best Practices](https://docs.npmjs.com/security)

---
**Last Updated**: September 8, 2025  
**Next Review**: September 22, 2025