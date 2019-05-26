#!/bin/bash
#
# ./scripts/pull.sh
#
# bill@f5.com
#
# Pulls an ILX workspace from a BIG-IP and syncs to ./workspace, excludes 
# ./workspace/extensions/ephemeral_auth/node_modules.
#
source ./scripts/env.sh
source ./scripts/util.sh

# get version of package from package.json
PACKAGE_VERSION=$(jq -r ".version" workspace/extensions/webssh2/package.json 2>&1)
# creates new workspace name with version 
webssh_workspace_name=$webssh_workspace_name-$PACKAGE_VERSION

echo "Pull ${fgLtCya}$webssh_workspace_name${fgLtWhi} from ${fgLtCya}$webssh_ilxhost${fgLtWhi}"

# check to see if the workspace actually exists before attempting to copy over

echoNotice "Checking for existing workspace ${fgLtCya}$webssh_workspace_name${fgLtWhi}"
runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh list ilx workspace $webssh_workspace_name one-line 2>&1"

echoNotice "Pulling ${fgLtCya}$webssh_workspace_name${fgLtWhi} from ${fgLtCya}$webssh_ilxhost${fgLtWhi}"
runCommand "rsync -e 'ssh -o ClearAllForwardings=yes -ax' -avq --include=\"extensions/ephemeral_auth/node_modules/f5-*\" --exclude=\".DS_Store\" --exclude=\"extensions/ephemeral_auth/node_modules/*\" $webssh_ilxhost:/var/ilx/workspaces/Common/$webssh_workspace_name/. workspace/. 2>&1"

echo -e "\n👍 Pull complete 👍\n"
