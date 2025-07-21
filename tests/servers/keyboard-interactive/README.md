# Keyboard Interactive SSH Server

A test SSH server that uses keyboard-interactive authentication and listens on port 4444.

## Quick Start

For comprehensive testing instructions and automated setup, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

### Automated Setup with tmux

```bash
# Start complete development environment
./start-dev.sh

# Test SSH connection
./test-connection.sh

# Stop all services
./stop-dev.sh
```

## Docker Configurations

We provide three Docker configurations for different testing scenarios:

1. **Dockerfile** - Basic SSH server with keyboard-interactive authentication
2. **Dockerfile.debug** - SSH server with password authentication and debug logging (recommended)
3. **Dockerfile.password** - SSH server with standard password authentication

## Basic Setup

```Dockerfile
# Use the Debian Bullseye Slim image as the base
FROM debian:bullseye-slim

# Install the necessary packages
# Use the Debian Bullseye Slim image as the base
FROM debian:bullseye-slim

# Install the necessary packages
RUN apt-get update && \
    apt-get install htop -y --no-install-recommends \
    openssh-server && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure SSH server
RUN mkdir /var/run/sshd && \
    sed -i 's/^ChallengeResponseAuthentication no/ChallengeResponseAuthentication yes/' /etc/ssh/sshd_config && \
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \
    echo 'Port 4444' >> /etc/ssh/sshd_config && \
    echo 'UsePAM yes' >> /etc/ssh/sshd_config && \
    echo 'AuthenticationMethods keyboard-interactive' >> /etc/ssh/sshd_config

# Add a test user with a password
RUN useradd -m testuser && \
    echo "testuser:testpassword" | chpasswd

# Expose port 4444
EXPOSE 4444

# Start the SSH server
CMD ["/usr/sbin/sshd", "-D", "-e"]
```

### Instructions:

1. **Build the Docker image**:
   ```bash
   docker build -t keyboard-ssh-server .
   ```

2. **Run the container**:
   ```bash
   docker run --rm -p 4444:4444 --name keyboard-ssh-server keyboard-ssh-server
   ```

This Dockerfile sets up an SSH server that listens on port 4444 and uses keyboard-interactive authentication. The `testuser` has been created with the password `testpassword`. 

You can connect to this SSH server using the following command:

```bash
ssh -p 4444 testuser@localhost
```

You'll be prompted for a password as part of the keyboard-interactive authentication process.

## Test Credentials

- **Host**: localhost
- **Port**: 4444
- **Username**: testuser
- **Password**: testpassword

## Development with tmux

The provided scripts automate the entire development setup:

1. **start-dev.sh** - Starts Docker SSH server, WebSSH2 server, and client in separate tmux sessions
2. **stop-dev.sh** - Stops all services and cleans up
3. **test-connection.sh** - Tests SSH connectivity to ensure the server is working

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed tmux usage and troubleshooting.
