#!/bin/bash
## displays and optionally changes version of product

source ./scripts/env.sh

source ./scripts/util.sh

echo
# get current version of workspace, ask to change or rebuild
webssh_ilx_ver=$(jq -r ".version" ./workspace/extensions/webssh2/package.json 2>&1)
if [[ $? -ne 0 ]]; then exit; echo "error reading ILX irule version";fi

echo "Current version of $webssh_workspace_name is: $webssh_ilx_ver"

echo -n "If you want to change this version, enter it now otherwise press enter to retain: "

read newver

echo

if [[ ("$newver" != "") ]]; then
  echo "Updating version of ILX to: $newver"
  export newver
  jq --arg newver "$newver" '.version = $newver' < ./workspace/extensions/webssh2/package.json > ./workspace/extensions/webssh2/package.json.new 
  if [[ $? -ne 0 ]]; then exit; echo "error changing version - ilx";fi
  mv ./workspace/extensions/webssh2/package.json.new ./workspace/extensions/webssh2/package.json
else
  echo "No changes made"
fi 
