# Docker Setup Guide

[← Back to Getting Started](../getting-started/) | [← Back to Documentation](../)

## Quick Start

```bash
docker run --rm -p 2222:2222 ghcr.io/billchurch/webssh2:latest
```

Access WebSSH2 at: `http://localhost:2222/ssh`

Images are published to both GitHub Container Registry and Docker Hub; the examples below default to GHCR.

## Docker Images

### Official Images

- `ghcr.io/billchurch/webssh2:latest` - Multi-arch image promoted from the latest stable release
- `ghcr.io/billchurch/webssh2:main` - Rolling build produced from the tip of the `main` branch
- `ghcr.io/billchurch/webssh2:2.3.3`, `ghcr.io/billchurch/webssh2:2.3`, `ghcr.io/billchurch/webssh2:2` - Immutable semantic-version tags for WebSSH2 2.3.3
- `ghcr.io/billchurch/webssh2:sha-<short>` - Exact commit builds (for example `sha-14ab49f`)

> All tags are also mirrored to Docker Hub as `billchurch/webssh2:<tag>` when you prefer that registry.

### Image Details

| Tag | Source | Notes |
|-----|--------|-------|
| `latest` | Latest git release (e.g. `webssh2-server-v2.3.3`) | Promoted after automated release pipeline succeeds |
| `main` | Current `main` branch | Best for testing upcoming changes; may change frequently |
| `2.3.3` / `2.3` / `2` | Release `webssh2-server-v2.3.3` | Choose exactness: patch (`2.3.3`), minor (`2.3`), or major (`2`) |
| `sha-<short>` | Specific commit (e.g. `sha-14ab49f`) | Ideal for reproducible rollbacks |

All tags reference the same multi-architecture manifest (`linux/amd64` and `linux/arm64`) and use the Node 22 Alpine runtime.

## Building Custom Image

### Basic Build

```bash
git clone https://github.com/billchurch/webssh2.git
cd webssh2
docker build -t my-webssh2 .
```

### Multi-stage Build (Optimized)

Create a custom `Dockerfile`:

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /srv/webssh2
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:22-alpine
WORKDIR /srv/webssh2
COPY --from=builder /srv/webssh2/node_modules ./node_modules
COPY . .
EXPOSE 2222
CMD ["node", "index.js"]
```

Build:
```bash
docker build -f Dockerfile.custom -t my-webssh2:optimized .
```

## Configuration Methods

### 1. Environment Variables (Recommended)

```bash
docker run -d \
  --name webssh2 \
  -p 2222:2222 \
  -e WEBSSH2_LISTEN_PORT=2222 \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_SSH_PORT=22 \
  -e WEBSSH2_HEADER_TEXT="Docker WebSSH2" \
  -e WEBSSH2_HTTP_ORIGINS="*:*" \
  ghcr.io/billchurch/webssh2:latest
```

### 2. Using config.json

```bash
# Create config.json
cat > config.json << EOF
{
  "listen": { "port": 2222 },
  "ssh": { "host": "ssh.example.com" },
  "header": { "text": "Docker WebSSH2" }
}
EOF

# Mount config file
docker run -d \
  --name webssh2 \
  -p 2222:2222 \
  -v "$(pwd)/config.json:/srv/webssh2/config.json:ro" \
  ghcr.io/billchurch/webssh2:latest
```

### 3. Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  webssh2:
    image: ghcr.io/billchurch/webssh2:latest
    container_name: webssh2
    restart: unless-stopped
    ports:
      - "2222:2222"
    environment:
      - WEBSSH2_LISTEN_PORT=2222
      - WEBSSH2_SSH_HOST=ssh.example.com
      - WEBSSH2_SSH_PORT=22
      - WEBSSH2_SSH_ALGORITHMS_PRESET=modern
      - WEBSSH2_HEADER_TEXT=Docker WebSSH2
      - WEBSSH2_HTTP_ORIGINS=https://yourdomain.com
      - DEBUG=webssh2:*
    # Optional: mount config file
    # volumes:
    #   - ./config.json:/srv/webssh2/config.json:ro
    networks:
      - webssh2-network

networks:
  webssh2-network:
    driver: bridge
```

Start:
```bash
docker-compose up -d
```

## Advanced Configurations

### With SSL/TLS

```bash
# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem

# Run with SSL
docker run -d \
  --name webssh2-ssl \
  -p 2222:2222 \
  -v "$(pwd)/key.pem:/srv/webssh2/key.pem:ro" \
  -v "$(pwd)/cert.pem:/srv/webssh2/cert.pem:ro" \
  -e WEBSSH2_SSL_KEY=/srv/webssh2/key.pem \
  -e WEBSSH2_SSL_CERT=/srv/webssh2/cert.pem \
  ghcr.io/billchurch/webssh2:latest
```

### With SSH Private Key

```bash
# Prepare private key (single line format)
KEY=$(cat ~/.ssh/id_rsa | tr '\n' '~' | sed 's/~/\\n/g')

# Run with private key
docker run -d \
  --name webssh2-key \
  -p 2222:2222 \
  -e WEBSSH2_USER_NAME=myuser \
  -e WEBSSH2_USER_PRIVATE_KEY="$KEY" \
  ghcr.io/billchurch/webssh2:latest
```

### Behind Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name webssh.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://webssh2:2222;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Kubernetes Deployment

### Basic Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webssh2
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webssh2
  template:
    metadata:
      labels:
        app: webssh2
    spec:
      containers:
      - name: webssh2
        image: billchurch/webssh2:latest
        ports:
        - containerPort: 2222
        env:
        - name: WEBSSH2_LISTEN_PORT
          value: "2222"
        - name: WEBSSH2_SSH_HOST
          value: "bastion.internal"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
---
apiVersion: v1
kind: Service
metadata:
  name: webssh2
spec:
  selector:
    app: webssh2
  ports:
  - port: 80
    targetPort: 2222
  type: LoadBalancer
```

### With ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webssh2-config
data:
  WEBSSH2_LISTEN_PORT: "2222"
  WEBSSH2_SSH_HOST: "ssh.internal"
  WEBSSH2_HEADER_TEXT: "K8s WebSSH2"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webssh2
spec:
  template:
    spec:
      containers:
      - name: webssh2
        image: billchurch/webssh2:latest
        envFrom:
        - configMapRef:
            name: webssh2-config
```

## Docker Security

### Run as Non-Root User

```dockerfile
FROM node:22-alpine
RUN addgroup -g 1001 -S webssh2 && \
    adduser -u 1001 -S webssh2 -G webssh2
USER webssh2
WORKDIR /home/webssh2
COPY --chown=webssh2:webssh2 . .
RUN npm ci --only=production
EXPOSE 2222
CMD ["node", "index.js"]
```

### Security Scanning

```bash
# Scan image for vulnerabilities
docker scan billchurch/webssh2

# Use Trivy
trivy image billchurch/webssh2
```

### Read-Only Container

```bash
docker run -d \
  --name webssh2-ro \
  --read-only \
  --tmpfs /tmp \
  -p 2222:2222 \
  billchurch/webssh2
```

## Resource Management

### Memory and CPU Limits

```bash
docker run -d \
  --name webssh2 \
  --memory="512m" \
  --memory-swap="512m" \
  --cpus="0.5" \
  -p 2222:2222 \
  billchurch/webssh2
```

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2222/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

## Debugging

### Interactive Debug Session

```bash
docker run -it --rm \
  -p 2222:2222 \
  -e DEBUG="webssh2:*" \
  -e NODE_ENV=development \
  billchurch/webssh2
```

### Access Container Logs

```bash
# View logs
docker logs webssh2

# Follow logs
docker logs -f webssh2

# Last 100 lines
docker logs --tail 100 webssh2
```

### Execute Commands in Container

```bash
# Shell access
docker exec -it webssh2 sh

# Check configuration
docker exec webssh2 node -e "console.log(JSON.stringify(require('./app/config'), null, 2))"
```

## Docker Networks

### Custom Network

```bash
# Create network
docker network create webssh2-net

# Run container on network
docker run -d \
  --name webssh2 \
  --network webssh2-net \
  -p 2222:2222 \
  billchurch/webssh2
```

### Connect to Host Network

```bash
docker run -d \
  --name webssh2 \
  --network host \
  -e WEBSSH2_LISTEN_PORT=2222 \
  billchurch/webssh2
```

## Persistence

### Session Persistence

```bash
# Create volume for sessions
docker volume create webssh2-sessions

# Mount volume
docker run -d \
  --name webssh2 \
  -v webssh2-sessions:/srv/webssh2/sessions \
  -p 2222:2222 \
  billchurch/webssh2
```

## Common Issues

### Cannot Connect to SSH Hosts

```bash
# Use host network mode
docker run -d --network host billchurch/webssh2

# Or specify DNS
docker run -d --dns 8.8.8.8 billchurch/webssh2
```

### WebSocket Connection Issues

Ensure your reverse proxy supports WebSocket:
- nginx: `proxy_set_header Upgrade $http_upgrade;`
- Apache: `ProxyPass / ws://localhost:2222/`

### Permission Denied

```bash
# Fix permissions
docker exec webssh2 chown -R node:node /srv/webssh2
```

## Best Practices

1. **Always use specific tags** in production (not `latest`)
2. **Set resource limits** to prevent resource exhaustion
3. **Use secrets management** for sensitive data
4. **Enable health checks** for container orchestration
5. **Use read-only containers** where possible
6. **Scan images regularly** for vulnerabilities
7. **Use multi-stage builds** to minimize image size

## Related Documentation

- [Installation Guide](./INSTALLATION.md)
- [Configuration Overview](../configuration/OVERVIEW.md)
- [Environment Variables](../configuration/ENVIRONMENT-VARIABLES.md)
- [Troubleshooting](../reference/TROUBLESHOOTING.md)
