# WebSSH2 v2.0 Migration Guide

This guide helps you migrate from WebSSH2 v0.2.x to v2.0, which includes the modernization to Node.js 22 and significant architectural improvements.

## Overview

WebSSH2 v2.0 represents a major modernization effort that includes:

- **Node.js 22 LTS** requirement (upgraded from v6.9.1+)
- **ES Modules** throughout the codebase (modern JavaScript imports/exports)
- **Async/Await** patterns replacing callback-based code
- **Updated Dependencies** including Socket.IO 4.8.1, Express 5.1.0, SSH2 1.17
- **Enhanced Security** with modern HTTP security headers and CSP
- **Comprehensive Testing** with Node.js native test runner and Playwright
- **Improved Configuration** with environment variable support

## Prerequisites

Before upgrading to v2.0:

1. **Upgrade Node.js** to version 22 LTS or higher
2. **Review your configuration** against the breaking changes
3. **Test your setup** in a non-production environment first

## Step-by-Step Migration

### 1. Node.js Version

**Required Action:** Upgrade to Node.js 22 LTS

```bash
# Check current version
node --version

# Install Node.js 22 LTS (use your preferred method)
# Via nvm:
nvm install 22
nvm use 22

# Via package manager or download from nodejs.org
```

### 2. Configuration Updates

**Required Action:** Update your `config.json` file structure

The configuration format has changed significantly. See [CONFIG.md](./CONFIG.md) for detailed breaking changes.

**Key Changes:**
- `socketio` section removed → replaced by internal configuration
- `algorithms` moved to `ssh.algorithms`
- New `http.origins` replaces `socketio.origins`
- Enhanced SSH authentication options

**Migration Steps:**

1. **Backup your current config:**
   ```bash
   cp config.json config.json.backup
   ```

2. **Create new config structure:**
   ```json
   {
     "listen": {
       "ip": "0.0.0.0",
       "port": 2222
     },
     "http": {
       "origins": ["*:*"]
     },
     "ssh": {
       "algorithms": {
         // Move your old algorithms here
       }
     }
   }
   ```

3. **Environment Variables (New!):**
   You can now use environment variables instead of config.json:
   ```bash
   export WEBSSH2_LISTEN_PORT=2222
   export WEBSSH2_HTTP_ORIGINS='["localhost:*"]'
   ```

### 3. Dependencies and Installation

**Required Action:** Fresh installation of dependencies

```bash
# Remove old dependencies
rm -rf node_modules package-lock.json

# Install with Node.js 22
npm install
```

### 4. Security Headers (Automatic)

**No Action Required:** v2.0 automatically includes modern security headers:

- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HTTPS only)

### 5. Client Module Changes

**Required Action:** Update to webssh2_client v2.0+

The client is now distributed as a separate npm package. Installation automatically handles this, but if you have custom modifications:

```bash
# Client is automatically installed as dependency
# For development, see DEVELOPMENT.md
```

### 6. Testing Your Migration

**Recommended Actions:**

1. **Start the server:**
   ```bash
   npm start
   # or for development:
   npm run dev
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Check connectivity:**
   - Access `http://localhost:2222/ssh/host/your-ssh-server`
   - Test SSH authentication
   - Verify terminal functionality

## Feature Improvements in v2.0

### Enhanced Authentication
- SSH private key authentication
- Encrypted private key support with passphrase
- Keyboard-interactive authentication improvements
- POST-based authentication for enterprise SSO

### Modern Development Experience
- Hot-reload development mode
- Comprehensive test suite
- ESLint and Prettier integration
- TypeScript definitions

### Security Enhancements
- Automatic security headers
- Content Security Policy
- Input sanitization and validation
- Session management improvements

## Docker Users

**Required Action:** Update your Docker setup

### Docker Working Directory Change (v2.3.3+)

**BREAKING CHANGE:** The Docker container working directory has changed:
- **Old path:** `/usr/src/app` (used in v2.0 - v2.3.2)
- **New path:** `/srv/webssh2` (v2.3.3+)

**Impact:** If you mount `config.json` or other files into the container, you must update your mount paths.

**Before (v2.3.2 and earlier):**
```bash
docker run -d \
  -v "$(pwd)/config.json:/usr/src/app/config.json:ro" \
  billchurch/webssh2:2.3.2
```

**After (v2.3.3+):**
```bash
docker run -d \
  -v "$(pwd)/config.json:/srv/webssh2/config.json:ro" \
  billchurch/webssh2:latest
```

**Docker Compose Update:**
```yaml
# Before
volumes:
  - ./config.json:/usr/src/app/config.json:ro

# After
volumes:
  - ./config.json:/srv/webssh2/config.json:ro
```

### Custom Dockerfiles

```dockerfile
# Use Node.js 22 base image
FROM node:22-alpine

# Update WORKDIR to new path
WORKDIR /srv/webssh2

# Your existing Dockerfile should work with minimal changes
```

For docker-compose users, the image will automatically use Node.js 22 when you pull the latest version.

## Troubleshooting Common Issues

### Issue: "Cannot find module" errors
**Solution:** Ensure you're using Node.js 22 and have run `npm install`

### Issue: Configuration not loading
**Solution:** Check your `config.json` against the new structure in [CONFIG.md](./CONFIG.md)

### Issue: Client assets not loading
**Solution:** Ensure `webssh2_client` dependency is properly installed

### Issue: WebSocket connection fails
**Solution:** Verify your `http.origins` configuration matches your client URLs

### Issue: SSH connection fails
**Solution:** Check your `ssh.algorithms` configuration and SSH server compatibility

## Rollback Instructions

If you need to rollback to v0.2.x:

1. **Restore Node.js version:**
   ```bash
   nvm use 16  # or your previous version
   ```

2. **Restore configuration:**
   ```bash
   cp config.json.backup config.json
   ```

3. **Install previous version:**
   ```bash
   npm install webssh2-server@0.2.24
   ```

## Getting Help

- **Issues:** Report problems at https://github.com/billchurch/webssh2/issues
- **Discussions:** Use GitHub Discussions for questions
- **Documentation:** See DOCS/ directory for detailed guides

## Next Steps

After successful migration:

1. **Review security settings** in your production environment
2. **Update monitoring/logging** to work with new log formats
3. **Consider enabling new features** like environment variable configuration
4. **Update your deployment scripts** to use Node.js 22

## Summary

WebSSH2 v2.0 brings significant improvements in performance, security, and maintainability. While the migration requires some configuration updates, the modernized codebase provides a solid foundation for future development.

The investment in upgrading to v2.0 provides:
- Better performance with modern JavaScript
- Enhanced security posture
- Improved development experience
- Long-term maintainability with current Node.js LTS