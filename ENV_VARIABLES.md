# WebSSH2 Environment Variables

WebSSH2 supports comprehensive configuration through environment variables, following the [12-Factor App](https://12factor.net/config) methodology. This makes it ideal for Docker containers, Kubernetes deployments, and cloud-native applications.

## Configuration Priority

Configuration is loaded with the following priority (highest to lowest):

1. **Environment Variables** (highest priority)
2. `config.json` file 
3. Built-in defaults (lowest priority)

## Environment Variable Format

All WebSSH2 environment variables use the `WEBSSH2_` prefix with underscore-delimited paths:

```bash
WEBSSH2_<SECTION>_<SETTING>=value
```

### Examples
```bash
WEBSSH2_LISTEN_PORT=3000
WEBSSH2_SSH_HOST=example.com
WEBSSH2_HEADER_TEXT="Production Environment"
```

## Complete Environment Variable Reference

### Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_LISTEN_IP` | string | `0.0.0.0` | IP address to bind the server to |
| `WEBSSH2_LISTEN_PORT` | number | `2222` | Port number for the web server |
| `PORT` | number | `2222` | Legacy port variable (use WEBSSH2_LISTEN_PORT) |

### HTTP Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_HTTP_ORIGINS` | array | `["*:*"]` | CORS allowed origins (comma-separated or JSON) |

#### Array Format Examples
```bash
# Comma-separated format
WEBSSH2_HTTP_ORIGINS="localhost:3000,*.example.com,api.test.com"

# JSON array format
WEBSSH2_HTTP_ORIGINS='["localhost:3000","*.example.com","api.test.com"]'
```

### User Defaults

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_USER_NAME` | string | `null` | Default username for SSH connections |
| `WEBSSH2_USER_PASSWORD` | string | `null` | Default password for SSH connections |
| `WEBSSH2_USER_PRIVATE_KEY` | string | `null` | Default private key (base64 encoded or file path) |
| `WEBSSH2_USER_PASSPHRASE` | string | `null` | Passphrase for encrypted private keys |

### SSH Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SSH_HOST` | string | `null` | Default SSH host to connect to |
| `WEBSSH2_SSH_PORT` | number | `22` | Default SSH port |
| `WEBSSH2_SSH_LOCAL_ADDRESS` | string | `null` | Local address for SSH connections |
| `WEBSSH2_SSH_LOCAL_PORT` | number | `null` | Local port for SSH connections |
| `WEBSSH2_SSH_TERM` | string | `xterm-color` | Terminal type |
| `WEBSSH2_SSH_READY_TIMEOUT` | number | `20000` | Connection ready timeout (ms) |
| `WEBSSH2_SSH_KEEPALIVE_INTERVAL` | number | `120000` | Keep-alive interval (ms) |
| `WEBSSH2_SSH_KEEPALIVE_COUNT_MAX` | number | `10` | Maximum keep-alive count |
| `WEBSSH2_SSH_ALLOWED_SUBNETS` | array | `[]` | Allowed subnets (comma-separated) |
| `WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE` | boolean | `false` | Always send keyboard-interactive prompts to client |
| `WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH` | boolean | `false` | Disable interactive authentication |

### SSH Algorithms

You can configure SSH algorithms in two ways:

#### Option 1: Algorithm Preset (Recommended)

| Variable | Values | Description |
|----------|--------|-------------|
| `WEBSSH2_SSH_ALGORITHMS_PRESET` | `modern`, `legacy`, `strict` | Use predefined algorithm sets |

**Preset Details:**
- **`modern`**: Strong algorithms for contemporary systems
- **`legacy`**: Compatible with older SSH implementations  
- **`strict`**: Only the most secure algorithms

#### Option 2: Individual Algorithm Arrays

| Variable | Type | Description |
|----------|------|-------------|
| `WEBSSH2_SSH_ALGORITHMS_CIPHER` | array | Encryption algorithms |
| `WEBSSH2_SSH_ALGORITHMS_KEX` | array | Key exchange algorithms |
| `WEBSSH2_SSH_ALGORITHMS_HMAC` | array | MAC algorithms |
| `WEBSSH2_SSH_ALGORITHMS_COMPRESS` | array | Compression algorithms |
| `WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY` | array | Server host key algorithms |

#### Algorithm Examples
```bash
# Using preset (recommended)
WEBSSH2_SSH_ALGORITHMS_PRESET=modern

# Using individual arrays
WEBSSH2_SSH_ALGORITHMS_CIPHER="aes256-gcm@openssh.com,aes128-gcm@openssh.com"
WEBSSH2_SSH_ALGORITHMS_KEX="ecdh-sha2-nistp256,ecdh-sha2-nistp384"
```

### Web Interface

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_HEADER_TEXT` | string | `null` | Header text in web interface |
| `WEBSSH2_HEADER_BACKGROUND` | string | `green` | Header background color |

### Application Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_OPTIONS_CHALLENGE_BUTTON` | boolean | `true` | Show challenge button |
| `WEBSSH2_OPTIONS_AUTO_LOG` | boolean | `false` | Enable automatic logging |
| `WEBSSH2_OPTIONS_ALLOW_REAUTH` | boolean | `true` | Allow reauthentication |
| `WEBSSH2_OPTIONS_ALLOW_RECONNECT` | boolean | `true` | Allow reconnection |
| `WEBSSH2_OPTIONS_ALLOW_REPLAY` | boolean | `true` | Allow session replay |

### Session Management

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEBSSH2_SESSION_SECRET` | string | auto-generated | Session encryption secret |
| `WEBSSH2_SESSION_NAME` | string | `webssh2.sid` | Session cookie name |

## Data Type Formats

### Boolean Values
Use `true`/`false` or `1`/`0`:
```bash
WEBSSH2_OPTIONS_AUTO_LOG=true
WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH=false
```

### Array Values
Two formats supported:

**Comma-separated (simple values):**
```bash
WEBSSH2_HTTP_ORIGINS="localhost:3000,*.example.com"
```

**JSON array (complex values or special characters):**
```bash
WEBSSH2_SSH_ALGORITHMS_CIPHER='["aes256-gcm@openssh.com","aes128-ctr"]'
```

### Null Values
Use empty string or `null`:
```bash
WEBSSH2_SSH_HOST=
WEBSSH2_USER_NAME=null
```

## Docker Examples

### Basic Docker Run
```bash
docker run -d \
  -p 2222:2222 \
  -e WEBSSH2_SSH_HOST=ssh.example.com \
  -e WEBSSH2_HEADER_TEXT="Production SSH" \
  -e WEBSSH2_HEADER_BACKGROUND=red \
  -e WEBSSH2_SESSION_SECRET=your-secret-key \
  webssh2:latest
```

### Docker with Modern Security
```bash
docker run -d \
  -p 2222:2222 \
  -e WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
  -e WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH=false \
  -e WEBSSH2_HEADER_TEXT="Secure SSH Gateway" \
  webssh2:latest
```

### Docker Compose
See `docker-compose.yml` for a complete example configuration.

## Kubernetes ConfigMap Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webssh2-config
data:
  WEBSSH2_LISTEN_PORT: "2222"
  WEBSSH2_SSH_HOST: "ssh.example.com"
  WEBSSH2_SSH_ALGORITHMS_PRESET: "modern"
  WEBSSH2_HEADER_TEXT: "Kubernetes SSH Gateway"
  WEBSSH2_HEADER_BACKGROUND: "blue"
  WEBSSH2_HTTP_ORIGINS: "*.example.com,localhost:*"
```

## Environment-First vs Config File

### Advantages of Environment Variables
- **Security**: No secrets in config files
- **Flexibility**: Easy per-environment configuration
- **Cloud-native**: Works with Docker, Kubernetes, etc.
- **CI/CD friendly**: Easy automated deployment configuration

### When to Use Config Files
- **Development**: Easier to manage many settings locally
- **Complex configurations**: Multiple algorithm arrays
- **Documentation**: Comments and structure in JSON

### Hybrid Approach
You can use both - environment variables override config.json:
```bash
# config.json has base settings
# Environment variables override specific values
WEBSSH2_LISTEN_PORT=3000
WEBSSH2_SSH_HOST=prod.example.com
```

## Validation and Debugging

### Debug Configuration Loading
Enable debug output to see configuration loading:
```bash
DEBUG=webssh2:config,webssh2:envConfig npm start
```

### Validation Errors
If configuration validation fails, the server will:
1. Log validation errors
2. Continue with unvalidated config in development
3. Use default values for invalid settings

### Testing Configuration
Test your environment variable configuration:
```bash
node -e "
import { getConfig } from './app/config.js';
const config = await getConfig();
console.log(JSON.stringify(config, null, 2));
"
```

## Migration from Config File

### Step 1: Identify Current Settings
Review your current `config.json` and identify values to move to environment variables.

### Step 2: Set Environment Variables
Convert config paths to environment variable names:
- `listen.port` → `WEBSSH2_LISTEN_PORT`
- `ssh.algorithms.cipher` → `WEBSSH2_SSH_ALGORITHMS_CIPHER`

### Step 3: Test Configuration
Verify environment variables take precedence over config file settings.

### Step 4: Remove Config File (Optional)
Once satisfied with environment variable configuration, you can remove `config.json`.

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use secure secret management** for `WEBSSH2_SESSION_SECRET`
3. **Restrict algorithm presets** - use `strict` for high-security environments
4. **Validate origins** - don't use wildcard origins (`*:*`) in production
5. **Use HTTPS** in production environments
6. **Rotate session secrets** regularly

## Troubleshooting

### Environment Variables Not Taking Effect
1. Check variable names are correct (case-sensitive)
2. Ensure `WEBSSH2_` prefix is used
3. Enable debug output: `DEBUG=webssh2:envConfig`
4. Check for typos in boolean values (`true`/`false`)

### Array Parsing Issues  
1. Use comma-separated format for simple values
2. Use JSON format for complex values or special characters
3. Escape quotes properly in shell environments

### Algorithm Configuration Problems
1. Use presets (`modern`, `legacy`, `strict`) for simplicity
2. Individual algorithms must be valid SSH algorithm names
3. Check SSH2 library documentation for supported algorithms

## Support

For issues with environment variable configuration:
1. Enable debug output: `DEBUG=webssh2:*`
2. Check the configuration validation output
3. Review this documentation for correct variable names and formats
4. Test with minimal configuration first