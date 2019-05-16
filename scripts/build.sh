#!/bin/bash
## Syncs from BIG-IP and builds a release based on version in extensions/ephemeral_auth/package.json

source ./scripts/env.sh

source ./scripts/util.sh

./scripts/pull.sh

package_version=$(jq -r ".version" workspace/extensions/webssh2/package.json)

webssh_workspace_name=$webssh_workspace_name-$package_version

ssh -o ClearAllForwardings=yes $webssh_ilxhost /bin/tar czf - -C /var/ilx/workspaces/Common/$webssh_workspace_name . > Build/Release/$webssh_package_name-$package_version.tgz

shasum -a 256 Build/Release/$webssh_package_name-$package_version.tgz > Build/Release/$webssh_package_name-$package_version.tgz.sha256

cp Build/Release/$webssh_package_name-$package_version.tgz $webssh_pua_location/$webssh_package_name-current.tgz
cp Build/Release/$webssh_package_name-$package_version.tgz.sha256 $webssh_pua_location/$webssh_package_name-current.tgz.sha256

find . -name '.DS_Store' -type f -delete
