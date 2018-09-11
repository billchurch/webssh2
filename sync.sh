#!/bin/bash
ilxhost=root@192.168.30.216
workspace_name=webssh2
package_name=BIG-IP-13.1.0.8-ILX-WebSSH2
pua_location=/Users/bill/Documents/GitHub/f5-pua/bin

rsync -e 'ssh -ax' -av --exclude extensions/$workspace_name/node_modules $ilxhost:/var/ilx/workspaces/Common/$workspace_name/. workspace/.
