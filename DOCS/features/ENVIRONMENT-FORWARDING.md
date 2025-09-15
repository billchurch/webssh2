# Environment Variables via URL

[← Back to Features](../features/) | [← Back to Documentation](../)

## Overview

WebSSH2 supports passing environment variables through URL parameters, allowing you to customize the SSH session environment. This feature enables scenarios like automatically opening specific files or setting custom environment variables.

## Quick Examples

Both routes are supported:

### Without Auto-connect (Login Form)
```
/ssh?env=FOO:bar,BAR:baz
```

### With Auto-connect (Host in URL)
```
/ssh/host/localhost?port=2244&env=FOO:bar,BAR:baz
```

**Tips:**
- Use `&env=...` when adding to an existing query string; do not add a second `?`
- Your SSH server must also allow each variable name via `AcceptEnv` in `sshd_config`
- You can restrict which variables are forwarded using an allowlist

## SSH Server Configuration

Before using this feature, you must configure your SSH server to accept the environment variables you want to pass.

### 1. Edit SSH Configuration

Edit your `/etc/ssh/sshd_config` file to include the desired variables in the `AcceptEnv` directive:

```bash
# Allow client to pass locale environment variables and custom vars
AcceptEnv LANG LC_* VIM_FILE CUSTOM_ENV
```

### 2. Restart SSH Server

Remember to restart your SSH server after making changes:

```bash
# For systemd-based systems
sudo systemctl restart sshd

# For init.d-based systems
sudo service sshd restart
```

## Usage

Pass environment variables using the `env` query parameter:

### Single Environment Variable
```
http://localhost:2222/ssh/host/example.com?env=VIM_FILE:config.txt
```

### Multiple Environment Variables
```
http://localhost:2222/ssh/host/example.com?env=VIM_FILE:config.txt,CUSTOM_ENV:test
```

### With Login Form
```
http://localhost:2222/ssh?env=VIM_FILE:config.txt,CUSTOM_ENV:test
```

## Security Considerations

To maintain security, environment variables must meet strict criteria:

### Variable Name Requirements

Variable names must:
- Start with a capital letter
- Contain only uppercase letters, numbers, and underscores (`^[A-Z][A-Z0-9_]*$`)
- Be listed in the SSH server's `AcceptEnv` directive

### Variable Value Restrictions

Variable values cannot contain shell special characters:
- `;` (semicolon)
- `&` (ampersand)
- `|` (pipe)
- `` ` `` (backtick)
- `$` (dollar sign)

### Server-Side Limits

WebSSH2 enforces the following limits:
- Maximum 50 key/value pairs
- Key length ≤ 32 characters
- Value length ≤ 512 characters

Invalid or disallowed variables are silently ignored.

## Allowlist Configuration

You can restrict which environment variables are forwarded using an allowlist.

### Via config.json
```json
{
  "ssh": {
    "envAllowlist": ["FOO", "BAR", "VIM_FILE"]
  }
}
```

### Via Environment Variable

Comma-separated format:
```bash
WEBSSH2_SSH_ENV_ALLOWLIST="FOO,BAR,VIM_FILE"
```

JSON array format:
```bash
WEBSSH2_SSH_ENV_ALLOWLIST='["FOO","BAR","VIM_FILE"]'
```

When an allowlist is provided, only listed keys are forwarded to the SSH session (after format/value checks).

## Example Usage

### Step 1: Configure SSH Server

Add to `/etc/ssh/sshd_config`:
```bash
AcceptEnv VIM_FILE CUSTOM_ENV PROJECT_ENV
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### Step 2: Create URL with Environment Variables

```
http://localhost:2222/ssh/host/example.com?env=VIM_FILE:settings.conf,CUSTOM_ENV:production
```

### Step 3: Use Variables in Shell

In your remote server's `.bashrc` or shell initialization file:

```bash
# Automatically open a file if specified
if [ ! -z "$VIM_FILE" ]; then
  vim "$VIM_FILE"
fi

# Show environment information
if [ ! -z "$CUSTOM_ENV" ]; then
  echo "Running in $CUSTOM_ENV environment"
fi

# Load project-specific settings
if [ ! -z "$PROJECT_ENV" ]; then
  source "/opt/configs/${PROJECT_ENV}.sh"
fi
```

## Troubleshooting

### Variables Not Visible on Remote Host

If variables aren't visible on the remote host after connecting:

1. **Check AcceptEnv Configuration**
   - Ensure `AcceptEnv` in `/etc/ssh/sshd_config` includes each variable name
   - Example: `AcceptEnv FOO BAR` (not `AcceptEnv FOO,BAR`)

2. **Restart SSH Service**
   - Always restart or reload SSHD after configuration changes:
   ```bash
   sudo systemctl reload sshd  # or restart
   ```

3. **Check SSH Server Logs**
   - Enable debug mode in sshd_config: `LogLevel DEBUG`
   - Look for `req env` lines in logs
   - Denied variables show as: `Ignoring env request BAR: disallowed name`

4. **Verify Match Blocks**
   - Some distributions or `Match` blocks override `AcceptEnv`
   - Ensure no later directives disable it

5. **Check URL Format**
   - Confirm your client URL uses `&env=...` (not a second `?`)
   - Example: `?port=22&env=FOO:bar` ✓
   - Wrong: `?port=22?env=FOO:bar` ✗

6. **Verify Allowlist**
   - With an allowlist configured, only listed names are forwarded
   - Check `ssh.envAllowlist` or `WEBSSH2_SSH_ENV_ALLOWLIST`

### Testing Variables

Test with a simple variable first:

1. Add to sshd_config: `AcceptEnv TEST_VAR`
2. Restart sshd
3. Connect with: `/ssh/host/server?env=TEST_VAR:hello`
4. Check in shell: `echo $TEST_VAR`

## Use Cases

### 1. Development Environment Setup
```
/ssh/host/dev-server?env=NODE_ENV:development,DEBUG:true
```

### 2. Automatic File Editing
```
/ssh/host/server?env=VIM_FILE:config.yaml,VIM_LINE:42
```

### 3. Project Context
```
/ssh/host/build-server?env=PROJECT:website,BRANCH:feature-123
```

### 4. Locale Settings
```
/ssh/host/server?env=LANG:en_US.UTF-8,LC_ALL:en_US.UTF-8
```

## Related Documentation

- [URL Parameters](../configuration/URL-PARAMETERS.md)
- [Configuration Overview](../configuration/OVERVIEW.md)
- [Security Best Practices](../reference/SECURITY.md)