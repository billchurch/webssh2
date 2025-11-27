# Stream Backpressure Stress Test

## Purpose
Validate that the stream backpressure and output limiting features prevent OOM crashes when handling high-volume SSH output.

## Prerequisites
1. Start WebSSH2 server with test configuration
2. Have SSH test server running (Docker or local)
3. Node.js process monitoring tool (e.g., `htop`, `ps`)

## Test Configuration

### Enable Rate Limiting (1MB/s)
```bash
export WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=1048576
export WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=10485760
export WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=16384
PORT=2288 npm run dev
```

### Unlimited (Default - for baseline)
```bash
PORT=2288 npm run dev
```

## Test Cases

### 1. Small Load Test (Should Pass)
Connect via WebSSH2 and run:
```bash
cat /dev/urandom | base64 | head -c 10M
```

**Expected:**
- Output completes successfully
- No memory spikes
- No disconnections

### 2. Medium Load Test (Should be throttled with rate limit)
```bash
cat /dev/urandom | base64 | head -c 100M
```

**Expected with rate limiting:**
- Output streams slowly (1MB/s)
- Memory remains stable
- No disconnections

**Expected without rate limiting:**
- Output streams quickly
- May cause memory pressure
- Possible disconnection

### 3. Infinite Stream Test (Should crash unlimited, survive with limits)
```bash
cat /dev/urandom | base64
```

**Expected with rate limiting:**
- Stream continues indefinitely at 1MB/s
- Memory stays within bounds
- User can Ctrl+C to stop

**Expected without rate limiting:**
- Memory grows continuously
- Node.js process crashes with OOM
- FATAL ERROR: Reached heap limit

### 4. Exec Command Output Limit Test
Via Socket.IO client or browser console:
```javascript
socket.emit('exec', { command: 'cat /dev/urandom | base64 | head -c 50M' })
```

**Expected:**
- Output truncated at 10MB
- Message: `[OUTPUT TRUNCATED: Exceeded maximum output size]`
- No crash

## Monitoring During Tests

### Terminal 1: Run tests
```bash
# Connect to WebSSH2 and run commands
```

### Terminal 2: Monitor Node.js memory
```bash
watch -n 1 'ps aux | grep node | grep webssh2 | awk "{print \$5, \$6, \$11}"'
```

### Terminal 3: System memory
```bash
htop
# or
docker stats webssh2  # if running in container
```

## Success Criteria

| Test Case | Rate Limit ON | Rate Limit OFF |
|-----------|---------------|----------------|
| Small (10MB) | ✅ Completes | ✅ Completes |
| Medium (100MB) | ✅ Throttled | ⚠️ Fast, stable |
| Infinite | ✅ Stable | ❌ Crashes |
| Exec (50MB) | ✅ Truncated | ✅ Truncated |

## Observed Behavior

### Before Fix
- Infinite stream causes heap exhaustion
- Process killed by OOM killer
- All users disconnected

### After Fix
- Rate limiting prevents unbounded buffering
- Exec commands truncated at 10MB
- Process remains stable under load

## Configuration Tuning

### For High-Volume Environments
```bash
# Increase limits for trusted users
export WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=52428800      # 50MB
export WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=5242880  # 5MB/s
export WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=65536       # 64KB
```

### For Restricted Environments
```bash
# Strict limits for untrusted users
export WEBSSH2_SSH_MAX_EXEC_OUTPUT_BYTES=1048576       # 1MB
export WEBSSH2_SSH_OUTPUT_RATE_LIMIT_BYTES_PER_SEC=262144   # 256KB/s
export WEBSSH2_SSH_SOCKET_HIGH_WATER_MARK=8192        # 8KB
```

## Automated Test Script

```bash
#!/bin/bash
# tests/manual/run-stress-test.sh

echo "=== Stream Backpressure Stress Test ==="
echo "Starting test at $(date)"

# Start monitoring in background
(while true; do
  ps aux | grep "node.*webssh2" | grep -v grep | awk '{printf "%s RSS=%sMB VSZ=%sMB\n", $11, $6/1024, $5/1024}'
  sleep 1
done) &
MONITOR_PID=$!

# Run test via SSH
echo "Running 100MB test..."
timeout 30s ssh -p 2289 testuser@localhost "cat /dev/urandom | base64 | head -c 100M" > /dev/null

echo "Waiting for memory to settle..."
sleep 5

# Check if process is still alive
if pgrep -f "node.*webssh2" > /dev/null; then
  echo "✅ Test passed: Node.js process survived"
else
  echo "❌ Test failed: Node.js process crashed"
fi

kill $MONITOR_PID
```

## Notes
- These tests should be run in a non-production environment
- Adjust timeouts based on your system's performance
- Monitor system resources to prevent impacting other services
- For containerized deployments, set appropriate resource limits
