#!/bin/bash

source env.sh

rsync -e 'ssh -ax' -av --delete --exclude='.DS_Store' --exclude extensions/$workspace_name/node_modules workspace/. $ilxhost:/var/ilx/workspaces/Common/$workspace_name/.

ssh $ilxhost chown -R root.sdm /var/ilx/workspaces/Common/$workspace_name/
ssh $ilxhost chmod -R ug+rwX,o-w /var/ilx/workspaces/Common/$workspace_name/
ssh $ilxhost chmod u+rw,go-w /var/ilx/workspaces/Common/$workspace_name/version
ssh $ilxhost chmod u+rw,go-w /var/ilx/workspaces/Common/$workspace_name/node_version
