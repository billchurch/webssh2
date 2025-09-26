# WebSSH2 Playwright Tests

End-to-end tests for WebSSH2, covering authentication, WebSocket connections, terminal functionality, and performance.

## Prerequisites

1. **Node.js** - Version 22 or higher
2. **Container Runtime** - One of the following (automatically detected):
   - **Docker** - Standard container runtime
   - **Apple Container Runtime** - macOS-native container runtime (command: `container`)
3. **Playwright** - Install with `npm run e2e:setup`

## Test Structure

```bash
tests/playwright/
├── constants.js                     # Shared test configuration
├── debug/                           # Debug and diagnostic tests
│   ├── debug-event-flow.spec.ts
│   ├── debug-post-auth-flow.spec.ts
│   └── debug-test.spec.js
├── performance/                     # Performance tests (archived for migration)
│   ├── PERFORMANCE_TESTS.md        # Performance test specifications
│   ├── websocket-latency.test.js.archived
│   └── websocket-performance.test.js.archived
├── e2e-term-size-replay.spec.ts    # Terminal size and replay tests
├── websocket-async-auth.test.js    # Async WebSocket authentication
├── websocket-auth.test.js          # WebSocket authentication scenarios
└── websocket-basic.test.js         # Basic WebSocket functionality
```

## Running Tests

### Quick Start

```bash
# Install Playwright and dependencies
npm run e2e:setup

# Run all E2E tests (starts SSH container automatically)
npm run test:e2e

# Run with debug output
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/playwright/websocket-auth.test.js

# Run tests in UI mode
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed
```

### NPM Scripts

- `npm run test:e2e` - Run all Playwright tests with SSH server
- `npm run test:e2e:debug` - Run tests with debug output
- `npm run e2e:setup` - Install Playwright with dependencies
- `npm run test` - Run unit tests
- `npm run test:all` - Run all tests (unit + integration)

## Test Configuration

Tests are configured in `playwright.config.ts`:

- **Test directory**: `./tests/playwright`
- **Timeout**: 60 seconds per test
- **Workers**: 1 (prevents SSH connection conflicts)
- **Browser**: Chromium
- **Base URL**: <http://localhost:2288>
- **Auto-start**: WebSSH2 server on port 2288
- **SSH container**: Automatically started when `ENABLE_E2E_SSH=1`

## Environment Variables

- `ENABLE_E2E_SSH=1` - Enables SSH container for E2E tests (automatically managed)
- `DEBUG=webssh2:*` - Enable debug logging
- `E2E_DEBUG=webssh2:*` - Enable debug logging for E2E tests

## Container Runtime Support

WebSSH2 E2E tests support both Docker and Apple Container Runtime with automatic detection:

### Automatic Detection

The test suite automatically detects which container runtime is available:
1. First checks for `container` (Apple Container Runtime)
2. Falls back to `docker` if Apple Container is not found
3. Throws an error if neither is available

### Apple Container Runtime

To use Apple Container Runtime on macOS:

```bash
# Install Apple Container Runtime
# See: https://github.com/apple/container
# Requires: macOS 26+ and Apple Silicon

# Start the container system service
container system start

# Run tests (container will be auto-detected)
npm run test:e2e
```

The test output will show which runtime was detected:
- `✓ Detected Apple Container Runtime (container)`
- `✓ Detected Docker runtime`

### Docker

Standard Docker installation works as before:

```bash
# Run tests with Docker
npm run test:e2e
```

### Manual Container Runtime Selection

Both runtimes use the same container image and configuration. The abstraction layer in `tests/playwright/container-runtime.ts` handles the runtime-specific commands automatically.

## Test Categories

### Authentication Tests

- Interactive authentication (valid/invalid credentials)
- Basic Auth scenarios
- HTTP POST authentication flow
- Connection error handling
- Session management

### WebSocket Tests

- Async connection establishment
- Auto-connect with Basic Auth
- Connection resilience
- Message flow validation

### Terminal Tests

- Terminal size and resize handling
- TERM environment variable validation
- Replay functionality
- Command execution

### Performance Tests (Archived)

Performance tests have been temporarily archived during the TypeScript migration.
See `performance/PERFORMANCE_TESTS.md` for detailed specifications and future implementation plans.

Key test categories:
- Connection establishment latency
- Large data transfer handling
- Rapid command execution
- Long-term connection stability
- Terminal resize performance
- Concurrent connection scaling

### Debug Tests (in `debug/` directory)

- Event flow analysis
- HTTP POST authentication flow
- Connection diagnostics

## Test Credentials

Default credentials for the test SSH server:

- **Host**: localhost
- **Port**: 2244 (SSH container) or 2289 (manual Docker)
- **Username**: testuser
- **Password**: testpassword

## Viewing Test Results

```bash
# View HTML report after test run
npx playwright show-report

# View test traces for debugging
npx playwright show-trace test-results/*/trace.zip

# Test artifacts location:
# - playwright-report/     # HTML report
# - test-results/         # Screenshots, videos, traces
```

## Debugging Failed Tests

### 1. Run in Debug Mode

```bash
# Debug specific test
npx playwright test websocket-auth.test.js --debug

# Run with verbose output
npm run test:e2e:debug
```

### 2. Check Test Artifacts

- Screenshots: `test-results/*/screenshot.png`
- Videos: `test-results/*/video.webm`
- Traces: `test-results/*/trace.zip`

### 3. Manual SSH Server (Optional)

If you need to run tests with a manual SSH server:

```bash
# Start test SSH container with Docker
docker run --rm -d \
  -p 2289:22 \
  -e SSH_USER=testuser \
  -e SSH_PASSWORD=testpassword \
  ghcr.io/billchurch/ssh_test:alpine

# Or with Apple Container Runtime
container run --rm -d \
  -p 2289:22 \
  -e SSH_USER=testuser \
  -e SSH_PASSWORD=testpassword \
  ghcr.io/billchurch/ssh_test:alpine

# Run tests against manual server
SSH_PORT=2289 npx playwright test
```

## CI/CD Integration

Tests run automatically in CI:

- On push to main branches
- On pull requests
- Multiple Node.js versions tested
- Test reports uploaded as artifacts

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :2288

# Kill the process if needed
pkill -f "node.*webssh2"
```

### SSH Container Issues

```bash
# Check if container is running (Docker)
docker ps | grep ssh

# Check if container is running (Apple Container)
container ps | grep ssh

# View container logs (Docker)
docker logs $(docker ps -q --filter ancestor=ghcr.io/billchurch/ssh_test:alpine)

# View container logs (Apple Container)
container logs $(container ps -q --filter ancestor=ghcr.io/billchurch/ssh_test:alpine)

# Remove stale containers (Docker)
docker rm -f $(docker ps -aq --filter name=webssh2)

# Remove stale containers (Apple Container)
container rm -f $(container ps -aq --filter name=webssh2)
```

### WebSocket Connection Fails

- Ensure server starts with WebSocket support
- Check browser console for errors
- Verify firewall/proxy settings

### Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check server logs: `DEBUG=webssh2:* npm run test:e2e:debug`
- Ensure Docker is running

## Writing New Tests

### Test Template

```javascript
import { test, expect } from '@playwright/test'
import { BASE_URL, SSH_HOST, SSH_PORT, USERNAME, PASSWORD, TIMEOUTS } from './constants.js'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto(`${BASE_URL}/ssh`)
    
    // Your test logic here
    
    await expect(page.locator('text=Connected')).toBeVisible()
  })
})
```

### Best Practices

1. Use constants from `constants.js`
2. Add appropriate timeouts for operations
3. Include meaningful assertions
4. Clean up resources in test teardown
5. Use descriptive test names
6. Group related tests with `test.describe`

## Contributing

When adding new tests:

1. Follow existing test patterns
2. Update this README if adding new test categories
3. Ensure tests pass locally before pushing
4. Add debug tests to `debug/` directory
5. Use TypeScript for new test files when possible
