# WebSSH2 WebSocket Playwright Tests

Comprehensive end-to-end tests for WebSSH2's WebSocket implementation, covering authentication scenarios, performance, and resilience.

## Prerequisites

1. **Docker** - Required for the test SSH server
2. **Node.js** - Version 18 or higher
3. **Playwright** - Will be installed automatically

## Test Structure

### Authentication Tests (`websocket-auth.test.js`)
Tests various authentication scenarios:
- ✅ Interactive authentication with valid credentials
- ✅ Interactive authentication with invalid credentials
- ✅ Connection errors (non-existent host, wrong port)
- ✅ Page refresh handling
- ✅ Basic Auth with valid credentials
- ✅ Basic Auth with invalid credentials
- ✅ Multiple command execution

### Performance Tests (`websocket-performance.test.js`)
Tests WebSocket performance and stability:
- ✅ Large data transfer handling
- ✅ Rapid command execution
- ✅ Terminal resize handling
- ✅ Connection establishment timing
- ✅ Special characters in commands
- ✅ Long-term connection stability

## Running Tests

### Quick Start

```bash
# Run all tests with the helper script
./run-tests.sh

# Run specific test file
./run-tests.sh websocket-auth.test.js
```

### Manual Setup

1. **Start the test SSH server:**
```bash
docker run -d --name webssh2-test-ssh -p 4444:22 \
  -e SSH_USER=testuser -e SSH_PASSWORD=testpassword \
  ghcr.io/billchurch/ssh_test:alpine
```

2. **Build the client with WebSocket support:**
```bash
cd ../webssh2_client
VITE_USE_WEBSOCKET=true npm run build
cd ../webssh2
npm link ../webssh2_client
```

3. **Install Playwright:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

4. **Run tests:**
```bash
# All tests
npm run test:playwright

# Authentication tests only
npm run test:playwright:auth

# Performance tests only
npm run test:playwright:perf

# Interactive UI mode
npm run test:playwright:ui

# Debug mode
npm run test:playwright:debug
```

## NPM Scripts

The following scripts are available in package.json:

- `npm run test:playwright` - Run all Playwright tests
- `npm run test:playwright:auth` - Run authentication tests
- `npm run test:playwright:perf` - Run performance tests
- `npm run test:playwright:ui` - Open Playwright UI mode
- `npm run test:playwright:debug` - Run tests in debug mode
- `npm run test:all` - Run all tests (unit + Playwright)

## Test Configuration

Tests are configured in `playwright.config.js`:
- **Timeout**: 30 seconds per test
- **Workers**: 1 (to avoid SSH connection conflicts)
- **Browsers**: Chromium, Firefox, WebKit
- **Reports**: HTML report with screenshots/videos on failure

## CI/CD Integration

Tests run automatically in GitHub Actions:
- On push to `main` or `develop` branches
- On pull requests to `main`
- Tests multiple Node.js versions (18.x, 20.x, 22.x)
- Uploads test reports and videos as artifacts

## Viewing Test Results

After running tests:

```bash
# View HTML report
npx playwright show-report

# Reports are saved in:
# - playwright-report/ (HTML report)
# - test-results/ (screenshots/videos on failure)
```

## Debugging Failed Tests

1. **Run in debug mode:**
```bash
npm run test:playwright:debug
```

2. **Check test artifacts:**
- Screenshots: `test-results/*/screenshot.png`
- Videos: `test-results/*/video.webm`
- Traces: `test-results/*/trace.zip`

3. **View traces:**
```bash
npx playwright show-trace test-results/*/trace.zip
```

## Test Credentials

Default test credentials (for test SSH server):
- **Host**: localhost
- **Port**: 4444
- **Username**: testuser
- **Password**: testpassword

## Troubleshooting

### Docker not running
```bash
# Start Docker Desktop or:
sudo systemctl start docker
```

### Port 4444 already in use
```bash
# Stop existing container
docker stop webssh2-test-ssh
docker rm webssh2-test-ssh
```

### WebSocket connection fails
```bash
# Ensure server is running with WebSocket support
USE_WEBSOCKET=true npm run dev
```

### Tests timeout
- Increase timeout in `playwright.config.js`
- Check if SSH server is healthy: `docker ps`
- Check server logs: `docker logs webssh2-test-ssh`

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Add appropriate assertions
4. Update this README if needed
5. Ensure tests pass locally before pushing

## License

Same as WebSSH2 project - MIT License