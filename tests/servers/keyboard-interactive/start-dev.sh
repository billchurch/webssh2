#!/bin/bash

# WebSSH2 Development Environment Setup
# This script sets up a complete development environment using tmux

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting WebSSH2 Development Environment...${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
if ! command_exists tmux; then
    echo -e "${RED}Error: tmux is not installed${NC}"
    echo "Install with: brew install tmux (macOS) or apt-get install tmux (Linux)"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Kill any existing sessions
echo -e "${YELLOW}Cleaning up existing sessions...${NC}"
tmux kill-session -t webssh2-docker 2>/dev/null || true
tmux kill-session -t webssh2-server 2>/dev/null || true
tmux kill-session -t webssh2-client 2>/dev/null || true
docker stop ssh-debug-server 2>/dev/null || true

# Get the script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"

# Build Docker image if it doesn't exist
if ! docker images | grep -q ssh-debug-server; then
    echo -e "${YELLOW}Building Docker SSH server image...${NC}"
    cd "$SCRIPT_DIR"
    docker build -f Dockerfile.debug -t ssh-debug-server .
fi

# Create tmux session for Docker SSH server
echo -e "${GREEN}Starting Docker SSH server session...${NC}"
tmux new-session -d -s webssh2-docker -c "$SCRIPT_DIR"
tmux send-keys -t webssh2-docker "# Docker SSH Test Server (Port 4444)" C-m
tmux send-keys -t webssh2-docker "# Credentials: testuser / testpassword" C-m
tmux send-keys -t webssh2-docker "docker run --rm -p 4444:4444 --name ssh-debug-server ssh-debug-server" C-m

# Wait a moment for Docker to start
sleep 2

# Create tmux session for WebSSH2 server
echo -e "${GREEN}Starting WebSSH2 server session...${NC}"
tmux new-session -d -s webssh2-server -c "$PROJECT_ROOT/webssh2"
tmux send-keys -t webssh2-server "# WebSSH2 Server (Port 2222)" C-m
if [ ! -d "node_modules" ]; then
    tmux send-keys -t webssh2-server "npm install" C-m
    sleep 5
fi
tmux send-keys -t webssh2-server "npm run watch" C-m

# Create tmux session for WebSSH2 client
echo -e "${GREEN}Starting WebSSH2 client session...${NC}"
tmux new-session -d -s webssh2-client -c "$PROJECT_ROOT/webssh2_client"
tmux send-keys -t webssh2-client "# WebSSH2 Client (Port 3000)" C-m
if [ ! -d "node_modules" ]; then
    tmux send-keys -t webssh2-client "npm install" C-m
    sleep 5
fi
tmux send-keys -t webssh2-client "npm run watch" C-m

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 3

# Show status
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
echo "  Stop all:          ./stop-dev.sh"
echo ""
echo -e "${GREEN}WebSSH2 will be available at: http://localhost:3000${NC}"
echo -e "${GREEN}SSH test server credentials:${NC}"
echo "  Host: localhost"
echo "  Port: 4444"
echo "  Username: testuser"
echo "  Password: testpassword"
echo ""
echo -e "${YELLOW}Press Ctrl+C to exit this message (services will continue running)${NC}"