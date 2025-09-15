# Quick Start Guide

[← Back to Getting Started](../getting-started/) | [← Back to Documentation](../)

## Prerequisites

- Node.js 22 LTS (Jod) or later
- npm or yarn package manager
- SSH server to connect to

## 5-Minute Setup

### 1. Install WebSSH2

```bash
# Clone the repository
git clone https://github.com/billchurch/webssh2.git
cd webssh2

# Install dependencies
npm install --production
```

### 2. Start the Server

```bash
npm start
```

WebSSH2 will start on port 2222 by default.

### 3. Access the Web Interface

Open your browser and navigate to:

```
http://localhost:2222/ssh
```

### 4. Connect to an SSH Server

Fill in the connection form:
- **Host/IP**: Your SSH server address
- **Port**: SSH port (usually 22)
- **Username**: Your SSH username
- **Password**: Your SSH password

Click "Connect" and you're in!

## Docker Quick Start

### Using Docker Hub Image

```bash
docker run --rm -p 2222:2222 billchurch/webssh2
```

### Building Your Own Image

```bash
# Build the image
docker build -t webssh2 .

# Run the container
docker run --rm -p 2222:2222 webssh2
```

Access at: `http://localhost:2222/ssh`

## Quick Configuration

### Using Environment Variables

```bash
# Set custom port
export WEBSSH2_LISTEN_PORT=3000

# Set default SSH host
export WEBSSH2_SSH_HOST=my-server.com

# Start with configuration
npm start
```

### Using Direct Connection URL

Skip the login form by using the host endpoint:

```
http://localhost:2222/ssh/host/my-server.com
```

You'll be prompted for credentials via HTTP Basic Auth.

## Common Use Cases

### 1. Local Development Server

```bash
# Connect to local VM
http://localhost:2222/ssh/host/192.168.1.100
```

### 2. Bastion/Jump Host

```bash
# Set bastion as default
export WEBSSH2_SSH_HOST=bastion.mycompany.com
npm start
```

### 3. Custom Port

```bash
# Run on port 8080
export WEBSSH2_LISTEN_PORT=8080
npm start
```

### 4. With Custom Header

```
http://localhost:2222/ssh?header=Development%20Server
```

## Next Steps

- [Installation Guide](./INSTALLATION.md) - Detailed installation instructions
- [Docker Setup](./DOCKER.md) - Complete Docker configuration
- [Configuration](../configuration/OVERVIEW.md) - Full configuration options
- [Authentication](../features/AUTHENTICATION.md) - Authentication methods

## Troubleshooting Quick Fixes

### Port Already in Use

```bash
# Use a different port
WEBSSH2_LISTEN_PORT=3000 npm start
```

### Connection Refused

1. Check if SSH server is running
2. Verify firewall rules
3. Test SSH connection directly: `ssh user@host`

### Can't Access from Another Machine

```bash
# Bind to all interfaces
export WEBSSH2_LISTEN_IP=0.0.0.0
npm start
```

## Getting Help

- [Troubleshooting Guide](../reference/TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/billchurch/webssh2/issues)
- [Documentation Index](../)