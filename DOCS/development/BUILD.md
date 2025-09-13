
## Issues with building
Working with node 6.9.1 has uncovered some challenges from time to time. Some of these are related to node 6.9.1 and others may not be, however these are some of the issues and fixes I've come across:

### npm ERR! Error: EPERM: operation not permitted, utime
This error with `npm` is related to be related to file permission issues, specifically the `EPERM` (Error: Operation not permitted) error. This is typically caused by the `npm` process trying to modify or access files in a way that the user running the process doesn't have permission to do.

Here are some steps you can try to resolve this issue:

1. **Ensure Correct File Permissions**:
   - Check the ownership and permissions of the directory `/workspaces/webssh2/node_modules/.staging/esquery-7b94f06a/dist` and its parent directories.
   - You can try running:
     ```bash
     sudo chown -R $(whoami) /workspaces/webssh2/node_modules
     ```
   - Alternatively, ensure that the `vscode` user has the necessary permissions to access and modify these files.

2. **Run npm install as the correct user**:
   - Make sure you're not accidentally running `npm` as a root or another user within the Docker container. If you're running it as the `vscode` user, ensure that the `vscode` user has the appropriate permissions in the `/workspaces/webssh2` directory.

3. **Clear npm cache**:
   - Sometimes this error can be caused by a corrupt npm cache. You can try clearing the cache:
     ```bash
     npm cache clean --force
     ```
   - After clearing the cache, try running `npm install` again.

4. **Check for Staging Issues**:
   - The error is occurring in a `.staging` directory, which is used by `npm` during the installation process. If the `.staging` directory is corrupted or incomplete, it can cause issues. You can remove the `node_modules` directory and try reinstalling:
     ```bash
     rm -rf node_modules
     npm install
     ```

5. **Try Running as Root (Not Recommended for Production)**:
   - As a last resort, you can try running `npm install` as root within the container. However, this is not recommended due to potential security risks:
     ```bash
     sudo npm install
     ```
