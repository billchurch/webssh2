#!/bin/bash
#
# ./scripts/pull.sh
#
# bill@f5.com
#
# Pulls an ILX workspace from a BIG-IP and syncs to ./workspace, excludes 
# ./workspace/extensions/ephemeral_auth/node_modules.

source ./scripts/env.sh

source ./scripts/util.sh

PACKAGE_VERSION=$(jq -r ".version" workspace/extensions/webssh2/package.json 2>&1)

webssh_workspace_name=$webssh_workspace_name-$PACKAGE_VERSION

# check to see if the workspace actually exists before attempting to copy over

output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh list ilx workspace $webssh_workspace_name one-line 2>&1)
result="$?" 2>&1

if [ $result -ne 0 ]; then
  echo -e "\n\n"
  echo "Workspace: $webssh_workspace_name not found, are you sure that's the right one?"
  echo -e "\n\n"
  echo "Terminating."
  echo -e "\n\n"
  exit 255
fi

output=$(rsync -e 'ssh -o ClearAllForwardings=yes -ax' -avq --include="extensions/ephemeral_auth/node_modules/f5-*" --exclude=".DS_Store" --exclude="extensions/ephemeral_auth/node_modules/*" $webssh_ilxhost:/var/ilx/workspaces/Common/$webssh_workspace_name/. workspace/. 2>&1)
result="$?" 2>&1

if [ $result -ne 0 ]; then
  echo -e "\n\n"
  echo "Something went wrong with the rsync..."
  echo -e "\n\n"
  echo "Terminating."
  echo -e "\n\n"
  exit 255
fi