#!/bin/bash
## Syncs from BIG-IP and builds a release based on version in extensions/ephemeral_auth/package.json

source env.sh

which jq
if [[ $? -ne 0 ]]; then
  echo -e "You need to install jq: https://stedolan.github.io/jq\n"
  echo -e "If you have *brew* you can install with:\n"
  echo -e "  brew install jq\n"
  echo -n "Do you want me to try and install that for you (Y/n)? "
  read -n1 yesno
  echo
  if [[ ("$yesno" != "y") ]]; then
    echo -e "\nUnable to continue, install jq first.\n\n"
    exit 255
  else
  which brew
    if [[ $? -ne 0 ]]; then
      echo -e "\nYou're a mess... You don't even have brew installed...\nMaybe you should check it out\n"
      echo -e "  https://brew.sh/\n\n"
      exit 255
    fi
    echo
    brew install jq
    if [[ $? -ne 0 ]]; then
      echo -e "\nLooks like that failed, I can't do everything... Quitting, install jq...\n"
      exit 255
    fi
  fi
fi

./sync.sh

package_version=$(jq -r ".version" workspace/extensions/$workspace_name/package.json)

ssh $ilxhost /bin/tar czf - -C /var/ilx/workspaces/Common/$workspace_name . > Build/Release/$package_name-$package_version.tgz

cp Build/Release/$package_name-$package_version.tgz $pua_location/$package_name-current.tgz
shasum -a 256 $pua_location/$package_name-current.tgz > $pua_location/$package_name-current.tgz.sha256

find . -name '.DS_Store' -type f -delete
find $pua_location -name '.DS_Store' -type f -delete
