#!/bin/bash

mkdir -p ~/.ssh && \
  touch ~/.ssh/known_hosts && \
  sudo tee ~/.ssh/config > /dev/null << EOF 
Host github.com
  HostName github.com
  PreferredAuthentications publickey
  IdentityFile ~/.hostssh/id_rsa.pub
EOF

sudo chown -R vscode:vscode ~/.ssh && \
  sudo chmod 600 ~/.ssh/config && \
  sudo chmod 600 ~/.ssh/known_hosts

git config --global --add safe.directory ${PWD}

# Get the signing key from git config
signing_key=$(git config --get user.signingkey)
if [ -z "$signing_key" ]; then
  echo "No signing key found in git config."
  exit 1
fi

# Get the user email from git config
user_email=$(git config --get user.email)
if [ -z "$user_email" ]; then
  echo "No user email found in git config."
  exit 1
fi

# Create the ~/.ssh directory if it doesn't exist
mkdir -p ~/.ssh

# Write the signing key and email to the allowed_signers file
echo "$user_email $signing_key" > ~/.ssh/allowed_signers

# Set the correct permissions for the allowed_signers file
chmod 644 ~/.ssh/allowed_signers

echo "allowed_signers file created successfully."

npm install
