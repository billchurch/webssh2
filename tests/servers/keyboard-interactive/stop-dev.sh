#!/bin/bash

# WebSSH2 Development Environment Cleanup
# This script stops all development services

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping WebSSH2 development environment...${NC}"

# Function to safely stop tmux session
stop_tmux_session() {
    local session_name=$1
    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo "Stopping $session_name..."
        tmux kill-session -t "$session_name"
    fi
}

# Stop tmux sessions
stop_tmux_session "webssh2-docker"
stop_tmux_session "webssh2-server"
stop_tmux_session "webssh2-client"

# Stop Docker container
if docker ps | grep -q ssh-debug-server; then
    echo "Stopping Docker SSH server..."
    docker stop ssh-debug-server
fi

# Clean up any orphaned containers
docker rm ssh-debug-server 2>/dev/null || true

echo -e "${GREEN}All services stopped.${NC}"

# Show any remaining tmux sessions
if tmux ls 2>/dev/null | grep -q webssh2; then
    echo -e "${YELLOW}Warning: Some WebSSH2 sessions may still be running:${NC}"
    tmux ls | grep webssh2
fi