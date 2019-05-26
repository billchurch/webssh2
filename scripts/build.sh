#!/bin/bash
## Syncs from BIG-IP and builds a release based on version in extensions/ephemeral_auth/package.json
#
source ./scripts/env.sh
source ./scripts/util.sh

./scripts/pull.sh

# get version of package from package.json
package_version=$(jq -r ".version" workspace/extensions/webssh2/package.json)
# creates new workspace name with version 
webssh_workspace_name=$webssh_workspace_name-$package_version

echoNotice "Creating workspace package" 
runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost /bin/tar --exclude='./extensions/webssh2/config.json' -czf - -C /var/ilx/workspaces/Common/$webssh_workspace_name . > Build/Release/$webssh_package_name-$package_version.tgz"

echoNotice "Creating SHA256 hash" 
runCommand "shasum -a 256 Build/Release/$webssh_package_name-$package_version.tgz > Build/Release/$webssh_package_name-$package_version.tgz.sha256"

echoNotice "Copying to current"
runCommand "cp Build/Release/$webssh_package_name-$package_version.tgz $webssh_pua_location/$webssh_package_name-current.tgz && \
            cp Build/Release/$webssh_package_name-$package_version.tgz.sha256 $webssh_pua_location/$webssh_package_name-current.tgz.sha256"

echoNotice "Deleting any '.DS_Store' files"
runCommand "find . -name '.DS_Store' -type f -delete"

echo -e "\nWorkspace packages located at:\n"
echo "  Build/Release/$webssh_package_name-$package_version.tgz"
echo "  Build/Release/$webssh_package_name-$package_version.tgz.sha256"
echo "  $webssh_pua_location/$webssh_package_name-current.tgz"
echo "  $webssh_pua_location/$webssh_package_name-current.tgz.sha256"

echo -e "\n👍 Build Complete 👍\n"
