#!/bin/bash
## displays and optionally changes version of product

source ./scripts/env.sh

source ./scripts/util.sh

echo
# get current version of workspace, ask to change or rebuild
webssh_ver=$(jq -r ".version" ./app/package.json 2>&1)
if [[ $? -ne 0 ]]; then exit; echo "error reading package version";fi

echo "Current version of package is: $webssh_ver"

echo -n "If you want to change this version, enter it now otherwise press enter to retain: "

read newver

echo

if [[ ("$newver" != "") ]]; then
  echo "Updating version of package to: $newver"
  export newver
  jq --arg newver "$newver" '.version = $newver' < ./app/package.json > ./app/package.json.new 
  if [[ $? -ne 0 ]]; then exit; echo "error changing version - ilx";fi
  mv ./app/package.json.new ./app/package.json
else
  echo "No changes made"
fi 
