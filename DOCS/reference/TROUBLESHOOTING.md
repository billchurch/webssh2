# Troubleshooting Guide

[← Back to Reference](../reference/) | [← Back to Documentation](../)

## Debugging

### Enable Debug Output

You can enable debug output from the console by passing the `DEBUG` environment variable to your start script:

```bash
# Debug WebSSH2 specific events (recommended)
DEBUG=webssh*,-webssh2:ssh2 npm run start

# Debug everything WebSSH2
DEBUG=webssh* npm run start

# Debug Socket.IO events
DEBUG=engine,socket npm run start

# Debug Express events
DEBUG=express:* npm run start

# Debug everything (very verbose)
DEBUG=* npm run start
```

**Note:** The `webssh2:ssh2` namespace is very chatty and shows all SSH protocol information. The `-webssh2:ssh2` excludes that namespace.

### Debug Namespaces

| Namespace | Description |
|-----------|-------------|
| `webssh2:*` | All WebSSH2 events |
| `webssh2:server` | Server initialization and configuration |
| `webssh2:socket` | WebSocket connection events |
| `webssh2:ssh` | SSH connection events (excluding protocol) |
| `webssh2:ssh2` | Detailed SSH2 protocol information |
| `webssh2:auth` | Authentication events |
| `engine` | Socket.IO engine events |
| `socket` | Socket.IO socket events |
| `express:*` | Express framework events |

## Common Issues

### Connection Issues

#### "Connection refused" or "ECONNREFUSED"

**Causes:**
- WebSSH2 server not running
- Incorrect port configuration
- Firewall blocking connection

**Solutions:**
1. Verify server is running: `ps aux | grep node`
2. Check port configuration: `netstat -an | grep 2222`
3. Test local connection: `curl http://localhost:2222/ssh`
4. Check firewall rules

#### "SSH Connection Failed"

**Causes:**
- Invalid SSH credentials
- SSH server not running on target
- Network connectivity issues

**Solutions:**
1. Test SSH directly: `ssh user@host`
2. Verify SSH service: `systemctl status sshd`
3. Check SSH logs: `tail -f /var/log/auth.log`
4. Verify network path: `ping target-host`

### Authentication Issues

#### "401 Unauthorized"

**Causes:**
- Invalid credentials
- Session expired
- SSO misconfiguration

**Solutions:**
1. Clear credentials: Navigate to `/ssh/clear-credentials`
2. Force re-authentication: Navigate to `/ssh/reauth`
3. Check SSO headers in debug mode
4. Verify authentication configuration

#### Private Key Authentication Fails

**Causes:**
- Wrong key format
- Missing passphrase
- Key not in authorized_keys

**Solutions:**
1. Ensure key is in PEM format
2. Convert key properly for config.json
3. Check server's `~/.ssh/authorized_keys`
4. Verify file permissions: `chmod 600 ~/.ssh/authorized_keys`

See [Private Keys Documentation](../features/PRIVATE-KEYS.md) for detailed setup.

### Terminal Issues

#### Garbled or Missing Characters

**Causes:**
- Wrong terminal type
- Character encoding mismatch
- Missing terminfo

**Solutions:**
1. Try different terminal types: `?sshterm=xterm`
2. Check locale: `locale`
3. Install terminfo: `infocmp xterm-256color`
4. Set UTF-8: `export LANG=en_US.UTF-8`

#### Terminal Size Issues

**Causes:**
- Resize events not propagating
- PTY size mismatch

**Solutions:**
1. Manually resize: Press `Ctrl+L` to refresh
2. Check window size: `echo $COLUMNS $LINES`
3. Reset terminal: `reset` or `tput reset`

### Environment Variable Issues

#### Variables Not Appearing in Session

**Causes:**
- SSH server not configured to accept variables
- Variable format incorrect
- Allowlist blocking variables

**Solutions:**
1. Check `AcceptEnv` in `/etc/ssh/sshd_config`
2. Verify variable format: `^[A-Z][A-Z0-9_]*$`
3. Check allowlist configuration
4. Restart SSH service after config changes

See [Environment Forwarding](../features/ENVIRONMENT-FORWARDING.md) for detailed setup.

### Performance Issues

#### Slow Terminal Response

**Causes:**
- Network latency
- Large scrollback buffer
- CPU throttling

**Solutions:**
1. Reduce scrollback: Configure in client settings
2. Use WebSocket transport only
3. Enable GPU acceleration in browser
4. Check server resources: `top` or `htop`

#### High Memory Usage

**Causes:**
- Memory leaks
- Too many concurrent sessions
- Large scrollback buffers

**Solutions:**
1. Limit concurrent sessions
2. Reduce scrollback buffer size
3. Monitor memory: `node --inspect`
4. Restart service periodically

### Docker Issues

#### Container Can't Connect to SSH Hosts

**Causes:**
- Network isolation
- DNS resolution issues

**Solutions:**
1. Use host network: `--network host`
2. Configure DNS: `--dns 8.8.8.8`
3. Check container networking: `docker network ls`

#### Configuration Not Loading

**Causes:**
- Wrong mount path
- Environment variables overriding

**Solutions:**
1. Mount to correct path: `/usr/src/app/config.json`
2. Check environment variables: `docker exec <container> env`
3. Verify file permissions in container

## Security Best Practices

### HTTPS Configuration

Always use HTTPS in production:

1. **Generate certificates:**
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

2. **Configure WebSSH2:**
   ```json
   {
     "ssl": {
       "key": "./key.pem",
       "cert": "./cert.pem"
     }
   }
   ```

### Session Security

1. **Configure secure cookies:**
   ```json
   {
     "session": {
       "secret": "change-this-secret",
       "cookie": {
         "secure": true,
         "httpOnly": true
       }
     }
   }
   ```

2. **Set session timeout:**
   ```json
   {
     "session": {
       "resave": false,
       "saveUninitialized": false,
       "rolling": true,
       "cookie": {
         "maxAge": 3600000
       }
     }
   }
   ```

### CORS Configuration

Restrict origins in production:

```json
{
  "http": {
    "origins": ["https://yourdomain.com"]
  }
}
```

Or via environment:
```bash
WEBSSH2_HTTP_ORIGINS="https://yourdomain.com"
```

## Browser Issues

### WebSocket Connection Fails

**Causes:**
- Browser blocking WebSocket
- Proxy interference
- CORS issues

**Solutions:**
1. Check browser console for errors
2. Verify CORS configuration
3. Test without proxy
4. Try different transport: Add polling fallback

### Copy/Paste Not Working

**Causes:**
- Browser security restrictions
- Clipboard API permissions

**Solutions:**
1. Use keyboard shortcuts: `Ctrl+Shift+C/V`
2. Enable clipboard permissions in browser
3. Use right-click context menu
4. Check browser compatibility

## Getting Help

### Before Opening an Issue

1. Check existing issues: [GitHub Issues](https://github.com/billchurch/webssh2/issues)
2. Enable debug mode and collect logs
3. Test with latest version
4. Try with minimal configuration

### Reporting Issues

Include the following:
- WebSSH2 version
- Node.js version
- Browser and version
- Debug output
- Configuration (sanitized)
- Steps to reproduce

### Community Support

- GitHub Discussions
- Stack Overflow tag: `webssh2`
- Email support for enterprise users

## Related Documentation

- [Development Guide](../development/SETUP.md)
- [Configuration Overview](../configuration/OVERVIEW.md)
- [Environment Variables](../configuration/ENVIRONMENT-VARIABLES.md)
- [Authentication](../features/AUTHENTICATION.md)