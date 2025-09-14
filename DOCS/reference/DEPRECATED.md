# Deprecated Features in WebSSH2

This document outlines features, configuration options, and parameters that have been deprecated in the this version of WebSSH2. Please review this information to ensure your setup remains compatible and to make necessary adjustments.

## Removed `config.json` Options

See [CONFIG.md](./CONFIG.md) for a list of removed or changed options.

### Logging Configuration

- `serverlog.client` (boolean): Enabled or disabled client logging.
- `serverlog.server` (boolean): Enabled or disabled server logging.
- `accesslog` (boolean): Controlled whether access logging was enabled.

### Other

- `verify` (boolean): This option was never implemented and has been removed.

## Removed GET Parameters

The following GET parameters have been **removed** from the application:

### Terminal Configuration Parameters

These have been replaced with client-side terminal configuration handling in the browser:

- `readyTimeout=`
- `cursorBlink=`
- `scrollback=`
- `tabStopWidth=`
- `bellStyle=`

### Header Parameters

- `allowReplay=` (boolean): Controlled the use of the password replay feature. This is now exclusively controlled from server-side `config.json`.
- `mrhsession=` (string): Used to pass an APM session for event correlation. This unused option has been removed.

## Required Actions

1. **Review and Update Configuration Files:**
   - Remove references to deprecated options in your `config.json` file.
   - If you relied on any of the removed terminal configuration options, implement client-side configurations instead.

2. **Update Integrations:**
   - If your integrations or workflows use any of the removed GET parameters, update them to remove these references.

3. **Logging and Verification Adjustments:**
   - If you relied on `serverlog`, `accesslog`, or `verify` options, you may need to implement custom solutions for logging and verification.

4. **Client-Side Terminal Configuration:**
   - Implement client-side terminal configurations to replace the removed server-side options.

5. **Review Header Configurations:**
   - Update any configurations or integrations that relied on `allowReplay` or `mrhsession` GET parameters.

6. **Test Your Setup:**
   - After making these changes, thoroughly test your WebSSH2 setup to ensure everything works as expected with the new configuration.

## Additional Notes

- The removal of these options is part of our effort to simplify the codebase and improve performance.
- If you encounter any issues after updating, please refer to the latest documentation or open an issue on our GitHub repository.
- For the most up-to-date information on configuration options, always refer to the current README.md and configuration files in the repository.

I appreciate your understanding and cooperation as we continue to improve WebSSH2. If you have any questions or need assistance with these changes, please don't hesitate to reach out to the project maintainers.