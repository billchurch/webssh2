#!/bin/bash

# Quick connection test script for SSH server

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing SSH connection to localhost:4444...${NC}"

# Check if expect is installed
if ! command -v expect >/dev/null 2>&1; then
    echo -e "${RED}Error: expect is not installed${NC}"
    echo "Install with: brew install expect (macOS) or apt-get install expect (Linux)"
    echo ""
    echo "Falling back to manual SSH (you'll need to enter password manually):"
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 4444 testuser@localhost
    exit 1
fi

# Create expect script
cat > /tmp/webssh2-test-ssh.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 10

spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 4444 testuser@localhost

expect {
    "password:" {
        send "testpassword\r"
        expect {
            -re ".*\\\$.*" {
                puts "\n*** Connection successful! ***"
                send "echo 'WebSSH2 Test Server is working!'\r"
                expect -re ".*\\\$.*"
                send "whoami\r"
                expect -re ".*\\\$.*"
                send "pwd\r"
                expect -re ".*\\\$.*"
                send "exit\r"
                expect eof
                exit 0
            }
            "Permission denied" {
                puts "\n*** Authentication failed ***"
                exit 1
            }
        }
    }
    "Connection refused" {
        puts "\n*** Connection refused - is the SSH server running? ***"
        exit 1
    }
    timeout {
        puts "\n*** Connection timeout ***"
        exit 1
    }
}
EOF

chmod +x /tmp/webssh2-test-ssh.exp

# Run the test
/tmp/webssh2-test-ssh.exp
RESULT=$?

# Clean up
rm -f /tmp/webssh2-test-ssh.exp

if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}SSH test passed!${NC}"
else
    echo -e "${RED}SSH test failed!${NC}"
    echo "Make sure the Docker container is running:"
    echo "  docker ps | grep ssh-debug-server"
fi

exit $RESULT