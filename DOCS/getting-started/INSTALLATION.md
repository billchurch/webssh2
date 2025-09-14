# Installation Guide

[← Back to Getting Started](../getting-started/) | [← Back to Documentation](../)

## Requirements

- **Node.js**: Version 22 LTS (Jod) or later
- **npm**: Version 10 or later (comes with Node.js)
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 512MB RAM
- **Disk Space**: ~200MB for installation

## Installation Methods

## Method 1: From Source (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/billchurch/webssh2.git
cd webssh2
```

### Step 2: Install Dependencies

For production deployment:
```bash
npm install --production
```

For development (includes dev dependencies):
```bash
npm install
```

### Step 3: Build (Optional)

If you're using TypeScript or need to build assets:
```bash
npm run build
```

### Step 4: Configure (Optional)

Create a `config.json` file or set environment variables:

```bash
# Using environment variables
export WEBSSH2_LISTEN_PORT=2222
export WEBSSH2_SSH_HOST=default.server.com
```

Or create `config.json`:
```json
{
  "listen": {
    "port": 2222
  },
  "ssh": {
    "host": "default.server.com"
  }
}
```

### Step 5: Start the Server

```bash
npm start
```

## Method 2: Docker Installation

### Using Docker Hub Image

```bash
# Pull the latest image
docker pull billchurch/webssh2:latest

# Run the container
docker run -d \
  --name webssh2 \
  -p 2222:2222 \
  billchurch/webssh2
```

### Building from Dockerfile

```bash
# Clone the repository
git clone https://github.com/billchurch/webssh2.git
cd webssh2

# Build the Docker image
docker build -t webssh2 .

# Run the container
docker run -d \
  --name webssh2 \
  -p 2222:2222 \
  webssh2
```

See [Docker Setup Guide](./DOCKER.md) for advanced Docker configuration.

## Method 3: Using npm Global Install

```bash
# Install globally (coming soon)
npm install -g webssh2

# Run
webssh2
```

**Note:** Global npm installation is planned for future releases.

## Platform-Specific Instructions

### Linux

#### Ubuntu/Debian

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install git
sudo apt-get install -y git

# Clone and install WebSSH2
git clone https://github.com/billchurch/webssh2.git
cd webssh2
npm install --production
```

#### RHEL/CentOS/Fedora

```bash
# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Install git
sudo yum install -y git

# Clone and install WebSSH2
git clone https://github.com/billchurch/webssh2.git
cd webssh2
npm install --production
```

### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@22

# Clone and install WebSSH2
git clone https://github.com/billchurch/webssh2.git
cd webssh2
npm install --production
```

### Windows

#### Using PowerShell

```powershell
# Install Node.js 22 from https://nodejs.org

# Clone repository
git clone https://github.com/billchurch/webssh2.git
cd webssh2

# Install dependencies
npm install --production

# Start server
npm start
```

#### Using WSL2 (Recommended for Windows)

Follow the Linux instructions above after setting up WSL2.

## Running as a Service

### systemd (Linux)

Create `/etc/systemd/system/webssh2.service`:

```ini
[Unit]
Description=WebSSH2 Service
After=network.target

[Service]
Type=simple
User=webssh2
WorkingDirectory=/opt/webssh2
ExecStart=/usr/bin/node /opt/webssh2/index.js
Restart=always
Environment="NODE_ENV=production"
Environment="WEBSSH2_LISTEN_PORT=2222"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable webssh2
sudo systemctl start webssh2
```

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start WebSSH2 with PM2
pm2 start index.js --name webssh2

# Save PM2 configuration
pm2 save

# Enable PM2 startup
pm2 startup
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  webssh2:
    image: billchurch/webssh2
    container_name: webssh2
    ports:
      - "2222:2222"
    environment:
      - WEBSSH2_LISTEN_PORT=2222
      - WEBSSH2_SSH_HOST=ssh.example.com
    restart: unless-stopped
```

Start with:
```bash
docker-compose up -d
```

## Verifying Installation

### Check Server Status

```bash
# Check if running
curl http://localhost:2222/ssh

# Check process
ps aux | grep node

# Check port
netstat -an | grep 2222
```

### Test Connection

1. Open browser to `http://localhost:2222/ssh`
2. Enter SSH server details
3. Connect to verify functionality

## Upgrading

### From Git

```bash
cd webssh2
git pull
npm install --production
npm run build  # if needed
# Restart the service
```

### Docker

```bash
docker pull billchurch/webssh2:latest
docker stop webssh2
docker rm webssh2
docker run -d --name webssh2 -p 2222:2222 billchurch/webssh2
```

## Uninstalling

### Manual Installation

```bash
# Stop the service
systemctl stop webssh2  # or pm2 stop webssh2

# Remove files
rm -rf /path/to/webssh2

# Remove service files if created
sudo rm /etc/systemd/system/webssh2.service
```

### Docker

```bash
docker stop webssh2
docker rm webssh2
docker rmi billchurch/webssh2
```

## Post-Installation

### Security Considerations

1. **Use HTTPS in production** - See [Security Guide](../reference/SECURITY.md)
2. **Configure firewall** - Only allow necessary ports
3. **Set strong session secrets** - Don't use defaults
4. **Limit CORS origins** - Configure `http.origins`

### Performance Tuning

1. **Adjust Node.js memory**: `node --max-old-space-size=4096 index.js`
2. **Configure connection limits** in config.json
3. **Use reverse proxy** (nginx/Apache) for production

## Troubleshooting Installation

### Node.js Version Issues

```bash
# Check Node.js version
node --version

# If wrong version, use nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

### Permission Errors

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Build Errors

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- [Quick Start Guide](./QUICK-START.md) - Get up and running quickly
- [Configuration Overview](../configuration/OVERVIEW.md) - Configure WebSSH2
- [Docker Setup](./DOCKER.md) - Advanced Docker configuration
- [Development Setup](../development/SETUP.md) - Set up development environment

## Getting Help

- [Troubleshooting Guide](../reference/TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/billchurch/webssh2/issues)
- [Documentation Index](../)