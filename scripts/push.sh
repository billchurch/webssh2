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

echo "Push ${fgLtCya}$webssh_workspace_name${fgLtWhi} to ${fgLtCya}$webssh_ilxhost${fgLtWhi}"

echoNotice "Checking $webssh_ilxhost for workspace $webssh_workspace_name"
output=$(ssh  -o ClearAllForwardings=yes $webssh_ilxhost tmsh list ilx workspace $webssh_workspace_name one-line 2>&1)
result="$?" 2>&1
if [ $result -ne 0 ]; then
  echo "❌"
  echoNotice "Attempting to create workspace"
  runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost \"tmsh create ilx workspace $webssh_workspace_name node-version 6.9.1\" 2>&1"
else
  echo "✅"
fi

echoNotice "Pushing ./workspace to $webssh_ilxhost at $webssh_workspace_name"
runCommand "rsync -e 'ssh -o ClearAllForwardings=yes -ax' -avq --delete --exclude='.DS_Store' --exclude extensions/webssh2/node_modules workspace/. $webssh_ilxhost:/var/ilx/workspaces/Common/$webssh_workspace_name/."

echoNotice "Installing node modules at $webssh_workspace_name on $webssh_ilxhost"
runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost \"cd /var/ilx/workspaces/Common/$webssh_workspace_name/extensions/webssh2; npm i --production\" 2>&1"

echoNotice "Setting permissions at $webssh_workspace_name on $webssh_ilxhost"
runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost \"chown -R root.sdm /var/ilx/workspaces/Common/$webssh_workspace_name/; \
  chmod -R ug+rwX,o-w /var/ilx/workspaces/Common/$webssh_workspace_name/; \
  chmod u+rw,go-w /var/ilx/workspaces/Common/$webssh_workspace_name/version; \
  chmod u+rw,go-w /var/ilx/workspaces/Common/$webssh_workspace_name/node_version\" 2>&1"

echoNotice "Deleting $webssh_workspace_name/node_modules/.bin on $webssh_ilxhost"
runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost \"cd /var/ilx/workspaces/Common/$webssh_workspace_name/extensions/webssh2; rm -rf node_modules/.bin\" 2>&1"

# switch plugin to new workspace
echoNotice "Checking to see if plugin exists"
output=$(ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh list ilx plugin WebSSH_plugin one-line 2>&1)
result="$?" 2>&1
if [ $result -ne 0 ]; then
  echo "❌"
  echoNotice "Attempting to create plugin"
  runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh create ilx plugin WebSSH_plugin from-workspace $webssh_workspace_name extensions { webssh2 { concurrency-mode single ilx-logging enabled } } 2>&1"
else
  echo "✅"
  echoNotice "Switching plugin to $webssh_workspace_name"
  runCommand "ssh -o ClearAllForwardings=yes $webssh_ilxhost tmsh modify ilx plugin WebSSH_plugin from-workspace $webssh_workspace_name extensions { webssh2 { concurrency-mode single ilx-logging enabled } } 2>&1"
fi

echo -e "\n👍 Push complete 👍\n"

exit 0
