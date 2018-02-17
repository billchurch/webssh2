#!/bin/bash
# Filename: /config/startup_script_webssh_commands.sh
# Initializes WebSSH2 tmm-to-node listener
# WebSSHVSIP should be the IP on an existing BIGIP virtual server assigned to
# the WebSSH2 service.
#
# bill@f5.com February 2018

export myFileName=$0
export REMOTEUSER=root
export WEBSSHVSIP=

# check to see if we're in /config/startup, if not add ourselves
IN_STARTUP=`grep startup_script_webssh_commands.sh /config/startup | wc -l`
if [ $IN_STARTUP -eq 0 ]; then
  echo Adding script to /config/startup and ensuring correct permissions...
  logger -p local0.notice -t $myFileName Adding $0 to /config/startup and ensuring correct permissions...
  chmod 755 /config/startup
  chmod 755 /config/startup_script_webssh_commands.sh
  echo /config/startup_script_webssh_commands.sh \& >> /config/startup
  echo >> /config/startup
fi

# Limit to 13 times in while-loop, ie. 12 x 10 secs sleep = 2 mins.
MAX_LOOP=13

while true
do
# check to see if tmm interface is up
IPLINKLIST=$(ip link list tmm 2>&1)
if [ $? -eq 0 ]; then
  if [ ! -z $WEBSSHVSIP ]; then
    IPADDRADD=$(/sbin/ip addr add $WEBSSHVSIP/32 dev tmm 2>&1)
    if [ $? -eq 0 ]; then
      # success
      echo SUCCESS $IPADDRADD
      logger -p local0.notice -t $myFileName IPADDRADD: SUCCESS: $IPADDRADD
    else
      # failure
      echo FAILURE $IPADDRADD
      logger -p local0.notice -t $myFileName IPADDRADD: FAILURE: $IPADDRADD
    fi
  else
    echo FAILURE: WEBSSHVSIP not specified.
    echo Open $0 and set the WEBSSHVSIP and try again
    echo
    logger -p local0.notice -t $myFileName IPADDRADD: FAILURE: NO WEBSSHVSIP SPECIFIED
  fi
  exit
fi
# If tmm interface is not up yet, script sleep 10 seconds and check again.
sleep 10

# Safety check not to run this script in background beyond 2 mins (ie. 12 times in while-loop).
if [ "$MAX_LOOP" -eq 1 ]; then
  logger -p local0.notice -t $myFileName tmm interface not up within 2 minutes. Exiting script.
  logger -p local0.notice -t $myFileName IPLINKLIST: $IPLINKLIST
  exit
fi
((MAX_LOOP--))
done

# End of file /config/startup_script_webssh_commands.sh
