# WebSSH2 Testing Guide with Docker SSH Server

This guide provides comprehensive instructions for setting up and running a test environment for WebSSH2 development using Docker containers and tmux.

## Overview

The testing environment consists of:
1. **SSH Test Server** - Docker container with SSH server on port 4444
2. **WebSSH2 Server** - Node.js backend on port 2222
3. **WebSSH2 Client** - Frontend development server on port 3000

## Docker SSH Test Server

### Available Docker Images

We provide three Docker configurations for different testing scenarios:

1. **Dockerfile** - Basic SSH server with keyboard-interactive authentication
2. **Dockerfile.debug** - SSH server with password authentication and debug logging
3. **Dockerfile.password** - SSH server with standard password authentication

### Building the Docker Image

```bash
# Navigate to the docker directory
cd webssh2/tests/servers/keyboard-interactive

# Build the debug image (recommended for testing)
docker build -f Dockerfile.debug -t ssh-debug-server .

# Or build the standard image
docker build -t ssh-test-server .

# Or build the password-only image
docker build -f Dockerfile.password -t ssh-password-server .
```

### Running the SSH Test Server

#### Basic Run Command

```bash
# Run in foreground (see logs)
docker run --rm -p 4444:4444 --name ssh-debug-server ssh-debug-server

# Run in background
docker run -d --rm -p 4444:4444 --name ssh-debug-server ssh-debug-server

# View logs of running container
docker logs -f ssh-debug-server
```

#### Test Credentials

- **Host**: localhost
- **Port**: 4444
- **Username**: testuser
- **Password**: testpassword

### Managing the Container

```bash
# Check if container is running
docker ps | grep ssh-debug-server

# Stop the container
docker stop ssh-debug-server

# Remove any stopped containers
docker rm ssh-debug-server 2>/dev/null || true

# View container logs
docker logs ssh-debug-server

# Connect to container shell (for debugging)
docker exec -it ssh-debug-server bash
```

## Complete Development Setup with tmux

### Prerequisites

- tmux installed (`brew install tmux` on macOS)
- Node.js >= 22
- Docker installed and running

### Automated tmux Setup

Create this script as `start-dev.sh`:

```bash
#!/bin/bash

# WebSSH2 Development Environment Setup
# This script sets up a complete development environment using tmux

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting WebSSH2 Development Environment...${NC}"

# Kill any existing sessions
tmux kill-session -t webssh2-docker 2>/dev/null || true
tmux kill-session -t webssh2-server 2>/dev/null || true
tmux kill-session -t webssh2-client 2>/dev/null || true

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"

# Create tmux session for Docker SSH server
echo -e "${GREEN}Starting Docker SSH server session...${NC}"
tmux new-session -d -s webssh2-docker -c "$PROJECT_ROOT/webssh2/tests/servers/keyboard-interactive"
tmux send-keys -t webssh2-docker "# Docker SSH Test Server (Port 4444)" C-m
tmux send-keys -t webssh2-docker "docker stop ssh-debug-server 2>/dev/null || true" C-m
tmux send-keys -t webssh2-docker "docker run --rm -p 4444:4444 --name ssh-debug-server ssh-debug-server" C-m

# Create tmux session for WebSSH2 server
echo -e "${GREEN}Starting WebSSH2 server session...${NC}"
tmux new-session -d -s webssh2-server -c "$PROJECT_ROOT/webssh2"
tmux send-keys -t webssh2-server "# WebSSH2 Server (Port 2222)" C-m
tmux send-keys -t webssh2-server "npm install" C-m
sleep 2
tmux send-keys -t webssh2-server "npm run dev" C-m

# Create tmux session for WebSSH2 client
echo -e "${GREEN}Starting WebSSH2 client session...${NC}"
tmux new-session -d -s webssh2-client -c "$PROJECT_ROOT/webssh2_client"
tmux send-keys -t webssh2-client "# WebSSH2 Client (Port 3000)" C-m
tmux send-keys -t webssh2-client "npm install" C-m
sleep 2
tmux send-keys -t webssh2-client "npm run dev" C-m

echo -e "${GREEN}All sessions started!${NC}"
echo ""
echo "tmux sessions:"
tmux ls
echo ""
echo -e "${YELLOW}Quick commands:${NC}"
echo "  View Docker logs:  tmux attach -t webssh2-docker"
echo "  View server logs:  tmux attach -t webssh2-server"
echo "  View client logs:  tmux attach -t webssh2-client"
echo "  Switch sessions:   Ctrl-b d (detach), then attach to another"
echo "  List sessions:     tmux ls"
echo ""
echo -e "${GREEN}WebSSH2 will be available at: http://localhost:3000${NC}"
echo -e "${GREEN}SSH test server credentials:${NC}"
echo "  Host: localhost"
echo "  Port: 4444"
echo "  Username: testuser"
echo "  Password: testpassword"
```

Make it executable:
```bash
chmod +x start-dev.sh
```

### Manual tmux Setup

If you prefer to set up each component manually:

```bash
# 1. Start Docker SSH server
tmux new-session -d -s webssh2-docker
tmux send-keys -t webssh2-docker "cd webssh2/tests/servers/keyboard-interactive" C-m
tmux send-keys -t webssh2-docker "docker run --rm -p 4444:4444 --name ssh-debug-server ssh-debug-server" C-m

# 2. Start WebSSH2 server
tmux new-session -d -s webssh2-server
tmux send-keys -t webssh2-server "cd webssh2" C-m
tmux send-keys -t webssh2-server "npm run dev" C-m

# 3. Start WebSSH2 client
tmux new-session -d -s webssh2-client
tmux send-keys -t webssh2-client "cd webssh2_client" C-m
tmux send-keys -t webssh2-client "npm run dev" C-m
```

### tmux Quick Reference

```bash
# List all sessions
tmux ls

# Attach to a session
tmux attach -t webssh2-server

# Detach from current session
# Press: Ctrl-b, then d

# Switch between sessions
# Press: Ctrl-b, then s (shows session list)

# Kill a session
tmux kill-session -t session-name

# Kill all sessions
tmux kill-server

# Create new window in session
# Press: Ctrl-b, then c

# Switch between windows
# Press: Ctrl-b, then window number (0-9)

# Split pane horizontally
# Press: Ctrl-b, then "

# Split pane vertically
# Press: Ctrl-b, then %

# Navigate between panes
# Press: Ctrl-b, then arrow keys
```

## Testing WebSSH2

### Direct SSH Connection Test

Test the SSH server is working correctly:

```bash
# Using ssh client
ssh -p 4444 testuser@localhost

# Using expect script (automated)
cat > /tmp/test-ssh.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 10
spawn ssh -o StrictHostKeyChecking=no -p 4444 testuser@localhost
expect "password:"
send "testpassword\r"
expect "$ "
send "echo 'Connection successful!'\r"
send "exit\r"
expect eof
EOF

chmod +x /tmp/test-ssh.exp
/tmp/test-ssh.exp
```

### WebSSH2 Connection Test

1. Ensure all three services are running (Docker, server, client)
2. Open browser to http://localhost:3000
3. Enter connection details:
   - Host: localhost
   - Port: 4444
   - Username: testuser
   - Password: testpassword
4. Click "Connect"

### Troubleshooting

#### Port Already in Use

```bash
# Find process using port 4444
lsof -i :4444

# Kill process using port
kill -9 $(lsof -t -i :4444)

# Or stop all Docker containers
docker stop $(docker ps -q)
```

#### Container Won't Start

```bash
# Remove any existing container
docker rm -f ssh-debug-server

# Check Docker logs
docker logs ssh-debug-server

# Rebuild image (clean build)
docker build --no-cache -f Dockerfile.debug -t ssh-debug-server .
```

#### Connection Refused

1. Check all services are running:
   ```bash
   tmux ls  # Should show 3 sessions
   docker ps  # Should show ssh-debug-server
   ```

2. Check ports are listening:
   ```bash
   lsof -i :4444  # SSH server
   lsof -i :2222  # WebSSH2 server
   lsof -i :3000  # WebSSH2 client
   ```

## Stop Everything

Create `stop-dev.sh`:

```bash
#!/bin/bash

echo "Stopping WebSSH2 development environment..."

# Kill tmux sessions
tmux kill-session -t webssh2-docker 2>/dev/null || true
tmux kill-session -t webssh2-server 2>/dev/null || true
tmux kill-session -t webssh2-client 2>/dev/null || true

# Stop Docker container
docker stop ssh-debug-server 2>/dev/null || true

echo "All services stopped."
```

## Development Workflow

1. Start the environment:
   ```bash
   ./start-dev.sh
   ```

2. Monitor logs in separate terminal windows:
   ```bash
   # Terminal 1
   tmux attach -t webssh2-server

   # Terminal 2
   tmux attach -t webssh2-client

   # Terminal 3
   tmux attach -t webssh2-docker
   ```

3. Make code changes - both server and client will auto-reload

4. Test in browser at http://localhost:3000

5. Stop everything when done:
   ```bash
   ./stop-dev.sh
   ```

## Advanced Testing

### Testing Different Authentication Methods

1. **Password Authentication** (default in Dockerfile.debug):
   - Works with standard password entry

2. **Keyboard-Interactive** (Dockerfile):
   - Tests PAM-based authentication
   - Useful for 2FA scenarios

3. **Public Key Authentication**:
   - Mount keys into container
   - Modify Dockerfile to add authorized_keys

### Performance Testing

Monitor resource usage:
```bash
# In tmux session
docker stats ssh-debug-server
```

### Security Testing

Test various SSH configurations by modifying sshd_config in Dockerfile.

## Notes

- The SSH server runs with DEBUG3 logging for maximum visibility
- All containers are run with `--rm` flag for automatic cleanup
- Default configuration uses password authentication for simplicity
- For production testing, use more secure configurations