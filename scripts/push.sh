#!/bin/bash
#
# ./scripts/push.sh
#
# bill@f5.com
#
# Pushes ./workspace to a BIG-IP ILX workspace
#

source ./scripts/env.sh

source ./scripts/util.sh

# get version of package from package.json
PACKAGE_VERSION=$(jq -r ".version" workspace/extensions/webssh2/package.json 2>&1)

# creates new workspace name with version 
webssh_workspace_name=$webssh_workspace_name-$PACKAGE_VERSION

echo -e "\n"
echo "Checking $webssh_ilxhost for workspace $webssh_workspace_name"
output=$(ssh  -o ClearAllForwardings=yes $webssh_ilxhost tmsh list ilx workspace $webssh_workspace_name one-line 2>&1)
result="$?" 2>&1

if [ $result -ne 0 ]; then
  echo -e "\n"
  echo "Workspace: $webssh_workspace_name not found, attempting to create"
  echo -e "\n\n"
  output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost "tmsh create ilx workspace $webssh_workspace_name node-version 6.9.1" 2>&1)
  result="$?" 2>&1
  if [ $result -ne 0 ]; then
    echo -e "\n\n"
    echo "Error creating workspace: $webssh_workspace_name... I give up, not sure what's going on..."
    echo -e "\n\n"
    exit 255
  fi
fi

echo -e "\n"
echo "Pushing ./workspace to $webssh_ilxhost at $webssh_workspace_name"
rsync -e 'ssh -o ClearAllForwardings=yes -ax' -avq --delete --exclude='.DS_Store' --exclude extensions/webssh2/node_modules workspace/. $webssh_ilxhost:/var/ilx/workspaces/Common/$webssh_workspace_name/.

echo -e "\n"
echo "Installing node modules at $webssh_workspace_name on $webssh_ilxhost"
output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost "cd /var/ilx/workspaces/Common/$webssh_workspace_name/extensions/webssh2; npm i --production" 2>&1)
result="$?" 2>&1

if [ $result -ne 0 ]; then
  echo -e "\n"
  echo "Error installing modules \"npm i --production\", process incomplete."
  echo -e "\n"
  echo "See output below:"
  echo -e "\n"
  echo $output

  exit 255
fi

echo -e "\n"
echo "Setting permissions at $webssh_workspace_name on $webssh_ilxhost"
output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost "chown -R root.sdm /var/ilx/workspaces/Common/$webssh_workspace_name/; \
  chmod -R ug+rwX,o-w /var/ilx/workspaces/Common/$webssh_workspace_name/; \
  chmod u+rw,go-w /var/ilx/workspaces/Common/$webssh_workspace_name/version; \
  chmod u+rw,go-w /var/ilx/workspaces/Common/$webssh_workspace_name/node_version" 2>&1)
result="$?" 2>&1
if [ $result -ne 0 ]; then
  echo -e "\n\n"
  echo "Error setting permissions... I give up, not sure what's going on..."
  echo -e "\n\n"
  exit 255
fi

echo -e "\n"
echo "Deleting $webssh_workspace_name/node_modules/.bin on $webssh_ilxhost"
output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost "cd /var/ilx/workspaces/Common/$webssh_workspace_name/extensions/webssh2; rm -rf node_modules/.bin" 2>&1)
result="$?" 2>&1

echo "Switching plugin to new workspace..."
# switch plugin to new workspace
output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh modify ilx plugin WebSSH_plugin from-workspace $webssh_workspace_name 2>&1)
result="$?" 2>&1
if [ $result -ne 0 ]; then
  echo -e "\n\n"
  echo "I give up, not sure what's going on..."
  echo -e "\n\n"
  exit 255
fi

echo -e "\n"
echo "Push complete, associated $auth_workspace_name with a WebSSH_plugin plugin. Test and validate."
echo -e "\n"
