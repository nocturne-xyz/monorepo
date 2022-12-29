#!/usr/bin/env bash

set -e

# Make sure that the working directory is always the directory of the script
cd "$(dirname "$0")"
echo "Installing forge deps..."
if [ -d "../lib/forge-std" ]; then
  if [ "$(ls -A ../lib/forge-std)" ]; then
    echo "forge deps already installed"
    echo "Skipping.."
  else
    echo "Dep directory found, but it's empty"
    echo "Cleaning up and installing deps.."
    rm -rf ../lib/forge-std
    forge install foundry-rs/forge-std@be5c649 --no-git
  fi
fi

echo "Installing circuit deps..."
../packages/circuits/scripts/install_deps.sh
