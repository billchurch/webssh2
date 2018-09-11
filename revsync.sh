#!/bin/bash
ilxhost=root@192.168.30.216
workspace_name=webssh2
package_name=BIG-IP-13.1.0.8-ILX-WebSSH2
pua_location=/Users/bill/Documents/GitHub/f5-pua/bin
echo 'hello'
rsync -e 'ssh -ax' -av --delete --exclude='.DS_Store' --exclude extensions/$workspace_name/node_modules workspace/. $ilxhost:/var/ilx/workspaces/Common/$workspace_name/.

ssh $ilxhost chown -R root.sdm /var/ilx/workspaces/Common/$workspace_name/
ssh $ilxhost chmod -R ug+rwX,o-w /var/ilx/workspaces/Common/$workspace_name/
ssh $ilxhost chmod u+rw,go-w /var/ilx/workspaces/Common/$workspace_name/version
ssh $ilxhost chmod u+rw,go-w /var/ilx/workspaces/Common/$workspace_name/node_version
