#!/bin/bash
# Utility functions / scripts

echoNotice () { echo -e -n "\n$@... "; }

fgLtRed=$(tput bold;tput setaf 1)
fgLtGrn=$(tput bold;tput setaf 2)
fgLtYel=$(tput bold;tput setaf 3)
fgLtBlu=$(tput bold;tput setaf 4)
fgLtMag=$(tput bold;tput setaf 5)
fgLtCya=$(tput bold;tput setaf 6)
fgLtWhi=$(tput bold;tput setaf 7)
fgLtGry=$(tput bold;tput setaf 8)

echo ${fgLtWhi}

# check for jq and try to install...
output=$(which jq 2>&1)
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

# checks the output of a command to get the status and report/handle failure
checkOutput() {
  if [ $result -eq 0 ]; then
    # success
    #echo "${fgLtGrn}[OK]${fgLtWhi}"
    echo "✅"
    return
  else
    # failure
    tput bel;tput bel;tput bel;tput bel
    #echo "${fgLtRed}[FAILED]${fgLtWhi}"
    echo "❌"
    echo -e "\nPrevious command failed in ${script_path}/${scriptname} with error level: ${result}"
    echo -e "\nCommand:\n"
    echo "  ${command}"
    echo -e "\nSTDOUT/STDERR:\n"
    echo ${output}
    exit 255
  fi
}

# run a comand and check call checkOutput
runCommand() {
  # $1 command
  command=$@
  output=$((eval $command) 2>&1)
  result="$?" 2>&1
  prevline=$(($LINENO-2))
  checkOutput
}