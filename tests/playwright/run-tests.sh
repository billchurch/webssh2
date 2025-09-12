#!/bin/bash

# WebSSH2 WebSocket Test Runner Script
# 
# This script sets up the test environment and runs Playwright tests
# for WebSocket authentication scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}WebSSH2 WebSocket Test Runner${NC}"
echo "================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if test SSH server is running
if ! docker ps | grep -q webssh2-test-ssh; then
    echo -e "${YELLOW}Starting test SSH server...${NC}"
    docker run -d --name webssh2-test-ssh -p 2244:22 \
        -e SSH_USER=testuser -e SSH_PASSWORD=testpassword \
        ghcr.io/billchurch/ssh_test:alpine
    
    # Wait for SSH server to be ready
    echo "Waiting for SSH server to be ready..."
    sleep 5
else
    echo -e "${GREEN}Test SSH server is already running${NC}"
fi

# Build the client with WebSocket support
echo -e "${YELLOW}Building client with WebSocket support...${NC}"
cd ../webssh2_client
VITE_USE_WEBSOCKET=true npm run build

# Link client to server
echo -e "${YELLOW}Linking client to server...${NC}"
cd ../webssh2
npm link ../webssh2_client

# Install Playwright if not already installed
if ! npm list @playwright/test > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing Playwright...${NC}"
    npm install --save-dev @playwright/test
    npx playwright install
fi

# Set environment variables
export USE_WEBSOCKET=true
export NODE_ENV=test
export DEBUG=webssh2:*

# Run specific test or all tests
if [ -n "$1" ]; then
    echo -e "${YELLOW}Running test: $1${NC}"
    npx playwright test "$1"
else
    echo -e "${YELLOW}Running all WebSocket authentication tests...${NC}"
    npx playwright test websocket-auth.test.js
fi

# Check test results
if [ $? -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${RED}Some tests failed. Check the output above.${NC}"
    echo -e "${YELLOW}To view the HTML report, run: npx playwright show-report${NC}"
    exit 1
fi

# Cleanup option
read -p "Do you want to stop the test SSH server? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Stopping test SSH server...${NC}"
    docker stop webssh2-test-ssh
    docker rm webssh2-test-ssh
fi

echo -e "${GREEN}Test run complete!${NC}"