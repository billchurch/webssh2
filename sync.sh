#!/bin/bash

source env.sh

rsync -e 'ssh -ax' -av --exclude extensions/$workspace_name/node_modules $ilxhost:/var/ilx/workspaces/Common/$workspace_name/. workspace/.
