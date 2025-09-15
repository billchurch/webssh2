# WebSSH2 Performance Tests Documentation

## Overview
This document outlines the performance test categories and specifications for WebSSH2. These tests were temporarily archived during the TypeScript migration and will be reimplemented as part of the performance optimization phase.

## Archived Test Files
- `websocket-performance.test.js.archived` - Comprehensive performance test suite
- `websocket-latency.test.js.archived` - Connection latency measurement

## Test Categories

### 1. Connection Performance
Tests focusing on connection establishment, authentication, and initial handshake timing.

#### 1.1 Connection Establishment Time
- **Purpose**: Measure time from connection initiation to "Connected" status
- **Metrics**: 
  - Time to establish WebSocket connection
  - Time to complete SSH handshake
  - Total connection time
- **Baseline**: < 3 seconds for local connections
- **Implementation**: See `websocket-latency.test.js.archived`

#### 1.2 Authentication Performance
- **Purpose**: Measure authentication processing time
- **Test Cases**:
  - Password authentication
  - Public key authentication
  - Keyboard-interactive authentication
- **Metrics**: Time from credential submission to authentication success

### 2. Data Transfer Performance
Tests measuring throughput and handling of large data volumes.

#### 2.1 Large Output Handling
- **Purpose**: Test terminal's ability to handle substantial data output
- **Test Command**: `seq 1 1000` or similar
- **Metrics**:
  - Time to render large output
  - Memory usage during transfer
  - Terminal responsiveness
- **Validation**: Verify complete output received and rendered

#### 2.2 Binary Data Transfer
- **Purpose**: Test file transfer capabilities (when implemented)
- **Metrics**:
  - Transfer speed (MB/s)
  - Data integrity verification
  - Memory efficiency

### 3. Command Execution Performance
Tests focusing on command execution speed and concurrency.

#### 3.1 Rapid Command Execution
- **Purpose**: Test handling of multiple rapid commands
- **Test Scenario**: Execute 7-10 commands in quick succession
- **Commands**:
  ```bash
  echo "test1"
  echo "test2"
  echo "test3"
  pwd
  whoami
  date
  echo "final"
  ```
- **Metrics**:
  - Command queuing efficiency
  - Output ordering preservation
  - No dropped commands

#### 3.2 Special Character Handling
- **Purpose**: Test processing of complex command strings
- **Test Cases**:
  - Quotes and escaping: `echo "Hello World!"`
  - Environment variables: `echo "$HOME"`
  - Special operators: `echo "Test & Test"`
  - Line breaks: `echo "Line1\\nLine2"`
- **Validation**: Correct parsing and execution

### 4. Terminal Operations Performance
Tests for terminal-specific operations and features.

#### 4.1 Terminal Resize Performance
- **Purpose**: Test dynamic terminal resizing
- **Test Scenarios**:
  - Resize from 1024x768 to 1200x800
  - Resize from 1200x800 to 800x600
  - Rapid consecutive resizes
- **Metrics**:
  - Time to process resize event
  - Content reflow accuracy
  - Connection stability during resize

#### 4.2 Scrollback Buffer Performance
- **Purpose**: Test scrollback buffer efficiency
- **Metrics**:
  - Memory usage with large scrollback
  - Scroll performance with 10,000+ lines
  - Search performance in buffer

### 5. Stability and Endurance Tests
Long-running tests to verify connection stability.

#### 5.1 Connection Stability Over Time
- **Purpose**: Verify connection remains stable over extended periods
- **Test Duration**: 5-30 minutes
- **Test Pattern**: Periodic echo commands every 5 seconds
- **Metrics**:
  - Connection uptime
  - Latency consistency
  - Memory leak detection

#### 5.2 Idle Connection Handling
- **Purpose**: Test keepalive and idle timeout behavior
- **Test Scenarios**:
  - Idle for 1 minute
  - Idle for 5 minutes
  - Idle for 15 minutes
- **Validation**: Connection remains active or properly times out

### 6. Concurrent Connection Performance
Tests for multiple simultaneous connections.

#### 6.1 Multiple Sessions
- **Purpose**: Test server handling of concurrent connections
- **Test Scenarios**:
  - 5 simultaneous connections
  - 10 simultaneous connections
  - 50 simultaneous connections (stress test)
- **Metrics**:
  - Per-connection latency
  - Resource usage scaling
  - Connection isolation

#### 6.2 Resource Contention
- **Purpose**: Test performance under resource constraints
- **Metrics**:
  - CPU usage per connection
  - Memory usage per connection
  - WebSocket message queue depth

## Implementation Guidelines

### Test Environment Setup
```javascript
// Standard test configuration
const PERFORMANCE_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:2222',
  sshHost: process.env.SSH_HOST || 'localhost',
  sshPort: process.env.SSH_PORT || '2289',
  username: process.env.SSH_USER || 'testuser',
  password: process.env.SSH_PASS || 'testpassword'
}

// Performance thresholds
const THRESHOLDS = {
  connectionTime: 3000,      // 3 seconds
  commandLatency: 500,       // 500ms
  resizeLatency: 200,        // 200ms
  largeOutputTime: 5000,     // 5 seconds for 1000 lines
}
```

### Measurement Utilities
```javascript
// Helper to measure operation time
async function measureTime(operation) {
  const startTime = Date.now()
  const result = await operation()
  const duration = Date.now() - startTime
  return { result, duration }
}

// Helper to collect performance metrics
class PerformanceCollector {
  constructor() {
    this.metrics = []
  }
  
  record(name, value) {
    this.metrics.push({ name, value, timestamp: Date.now() })
  }
  
  getStats(name) {
    const values = this.metrics
      .filter(m => m.name === name)
      .map(m => m.value)
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    }
  }
}
```

### Test Execution Strategy

1. **Isolation**: Each performance test should run in isolation to avoid interference
2. **Warm-up**: Include warm-up runs before collecting metrics
3. **Multiple Runs**: Execute each test multiple times and report statistics
4. **Environment Control**: Document and control test environment variables
5. **Baseline Establishment**: Record baseline metrics for regression detection

### Reporting Format
```json
{
  "testName": "WebSocket Connection Latency",
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": {
    "node": "22.0.0",
    "platform": "linux",
    "cpus": 4,
    "memory": "8GB"
  },
  "results": {
    "duration": {
      "min": 1250,
      "max": 1650,
      "avg": 1425,
      "unit": "ms"
    },
    "samples": 10,
    "passed": true
  }
}
```

## Future Enhancements

### Planned Performance Tests
1. **WebSocket frame analysis** - Measure frame size optimization
2. **Compression effectiveness** - Test compression ratios and CPU trade-offs
3. **Encryption overhead** - Measure crypto operations impact
4. **Browser compatibility** - Performance across different browsers
5. **Network condition simulation** - Test with various latency/bandwidth conditions

### Performance Monitoring Integration
- Real-time performance dashboard
- Automated performance regression detection
- Performance budgets in CI/CD pipeline
- User-facing performance metrics

## Running Performance Tests

### Individual Test Execution
```bash
# Run specific archived test (when re-enabled)
npx playwright test tests/playwright/performance/websocket-performance.test.js

# Run with performance reporter
npx playwright test --reporter=./tests/reporters/performance-reporter.js
```

### Continuous Performance Testing
```bash
# Run performance suite
npm run test:performance

# Run with baseline comparison
npm run test:performance:compare

# Generate performance report
npm run test:performance:report
```

## Notes for Migration

When re-implementing these tests in TypeScript:

1. **Type Safety**: Add proper TypeScript interfaces for performance metrics
2. **Async Patterns**: Use modern async/await patterns consistently
3. **Metric Collection**: Implement a centralized metric collection service
4. **Test Fixtures**: Create reusable test fixtures for common scenarios
5. **Parallel Execution**: Design tests to run in parallel where possible
6. **Resource Cleanup**: Ensure proper cleanup of connections and resources

## References

- Original test file: `websocket-performance.test.js.archived`
- Latency test: `websocket-latency.test.js.archived`
- Playwright documentation: https://playwright.dev/docs/test-configuration
- WebSocket performance best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API