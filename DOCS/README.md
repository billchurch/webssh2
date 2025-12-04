# WebSSH2 Documentation

Welcome to the comprehensive WebSSH2 documentation. This guide covers installation, configuration, features, and development.

## 📚 Documentation Structure

### 🚀 Getting Started

New to WebSSH2? Start here:

- **[Quick Start Guide](./getting-started/QUICK-START.md)** - Get up and running in 5 minutes
- **[Installation Guide](./getting-started/INSTALLATION.md)** - Detailed installation for all platforms
- **[Docker Setup](./getting-started/DOCKER.md)** - Docker and Kubernetes deployment
- **[Migration Guide](./getting-started/MIGRATION.md)** - Upgrading from older versions

### ⚙️ Configuration

Learn how to configure WebSSH2:

- **[Configuration Overview](./configuration/OVERVIEW.md)** - Configuration methods and priority
- **[Environment Variables](./configuration/ENVIRONMENT-VARIABLES.md)** - Complete environment variable reference
- **[config.json Schema](./configuration/CONFIG-JSON.md)** - JSON configuration file format
- **[URL Parameters](./configuration/URL-PARAMETERS.md)** - Query string parameters
- **[Constants](./configuration/CONSTANTS.md)** - Built-in constants reference

### ✨ Features

Explore WebSSH2 capabilities:

- **[Client Features](./features/CLIENT-FEATURES.md)** - Terminal, clipboard, search, and UI features
- **[SFTP File Transfer](./features/SFTP.md)** - Upload and download files through the browser
- **[Authentication Methods](./features/AUTHENTICATION.md)** - Password, key-based, and SSO authentication
- **[Private Key Authentication](./features/PRIVATE-KEYS.md)** - SSH key setup and usage
- **[Keyboard Interactive](./features/KEYBOARD-INTERACTIVE.md)** - Multi-factor authentication support
- **[Exec Channel](./features/EXEC-CHANNEL.md)** - Non-interactive command execution
- **[Environment Forwarding](./features/ENVIRONMENT-FORWARDING.md)** - Pass environment variables to SSH sessions
- **[SSO Integration](./features/SSO.md)** - Single Sign-On configuration

### 🔌 API Reference

Technical API documentation:

- **[Routes API](./api/ROUTES.md)** - HTTP endpoints and authentication
- **[WebSocket API](./api/WEBSOCKET-API.md)** - Socket.IO events and protocol

### 🏗️ Architecture

Understanding WebSSH2 internals:

- **[Client Architecture](./architecture/CLIENT.md)** - Browser-side architecture and components
- **[Event Flow](./architecture/EVENT-FLOW.md)** - Request and event processing flow
- **[System Flows](./architecture/FLOWS.md)** - Authentication and connection flows

### 👩‍💻 Development

For contributors and developers:

- **[Contributing Guide](./development/CONTRIBUTING.md)** - How to contribute to WebSSH2
- **[Development Setup](./development/SETUP.md)** - Setting up development environment
- **[Testing Guide](./development/TESTING.md)** - Running and writing tests
- **[Build Process](./development/BUILD.md)** - Building and packaging
- **[Build & Packaging Guide](./BUILD.md)** - Reproducible release artifact workflow
- **[PR Checklist](./development/LOCAL-PR-CHECKLIST.md)** - Before submitting pull requests

### 🚢 Deployment

- **[Container & Downstream Integration](./CONTAINER.md)** - Consuming release artifacts in CI/CD

### 📖 Reference

Additional resources:

- **[Troubleshooting Guide](./reference/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Breaking Changes](./reference/BREAKING-CHANGES.md)** - Version migration notes
- **[Deprecated Features](./reference/DEPRECATED.md)** - Features being phased out
- **[Changelog](./reference/CHANGELOG.md)** - Historical changes

### 📁 Archive

Historical and reference documentation:

- [Archive Directory](./archive/) - Older documentation for reference

## 🎯 Quick Links by Use Case

### "I want to..."

#### Deploy WebSSH2
- [Quick Start](./getting-started/QUICK-START.md)
- [Docker Setup](./getting-started/DOCKER.md)
- [Installation Guide](./getting-started/INSTALLATION.md)

#### Configure Authentication
- [Authentication Overview](./features/AUTHENTICATION.md)
- [Private Keys](./features/PRIVATE-KEYS.md)
- [SSO Setup](./features/SSO.md)

#### Customize the Interface
- [URL Parameters](./configuration/URL-PARAMETERS.md)
- [Environment Variables](./configuration/ENVIRONMENT-VARIABLES.md)

#### Transfer Files
- [SFTP File Browser](./features/SFTP.md)
- [Client Features](./features/CLIENT-FEATURES.md)

#### Integrate with My Application
- [Routes API](./api/ROUTES.md)
- [WebSocket API](./api/WEBSOCKET-API.md)
- [Exec Channel](./features/EXEC-CHANNEL.md)

#### Troubleshoot Issues
- [Troubleshooting Guide](./reference/TROUBLESHOOTING.md)
- [Debug Mode](./reference/TROUBLESHOOTING.md#debugging)

#### Contribute to the Project
- [Contributing Guide](./development/CONTRIBUTING.md)
- [Development Setup](./development/SETUP.md)
- [PR Checklist](./development/LOCAL-PR-CHECKLIST.md)

## 📋 Configuration Examples

### Basic Setup
```bash
export WEBSSH2_LISTEN_PORT=2222
export WEBSSH2_SSH_HOST=ssh.example.com
npm start
```

### Docker with SSL
```bash
docker run -d \
  -p 443:2222 \
  -v ./certs:/certs \
  -e WEBSSH2_SSL_KEY=/certs/key.pem \
  -e WEBSSH2_SSL_CERT=/certs/cert.pem \
  billchurch/webssh2
```

### Kubernetes with ConfigMap
```yaml
kubectl create configmap webssh2 \
  --from-literal=WEBSSH2_LISTEN_PORT=2222 \
  --from-literal=WEBSSH2_SSH_HOST=bastion.internal
```

## 🔍 Search Documentation

Looking for something specific? Use your browser's search function (`Ctrl+F` / `Cmd+F`) or explore the categories above.

## 💡 Tips

- **Environment variables** are preferred over config.json for production deployments
- **Use HTTPS** in production to secure credentials
- **Enable debug mode** with `DEBUG=webssh2:*` for troubleshooting
- **Check breaking changes** when upgrading versions

## 🆘 Getting Help

1. Check the [Troubleshooting Guide](./reference/TROUBLESHOOTING.md)
2. Search [existing GitHub issues](https://github.com/billchurch/webssh2/issues)
3. Join the discussion on [GitHub Discussions](https://github.com/billchurch/webssh2/discussions)
4. Open a new issue with debug logs and configuration details

## 📝 Documentation Updates

This documentation is maintained alongside the code. To report documentation issues or suggest improvements:

1. Open an issue labeled `documentation`
2. Submit a PR with documentation changes
3. Follow the [Contributing Guide](./development/CONTRIBUTING.md)

---

[← Back to Main README](../README.md) | [GitHub Repository](https://github.com/billchurch/webssh2)
