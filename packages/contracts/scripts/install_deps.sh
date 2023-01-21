#!/usr/bin/env bash
set -e

# Make sure that the working directory is always the monorepo root
SCRIPT_DIR="$(dirname "$0")"
ROOT_DIR="$SCRIPT_DIR/../../.."
cd "$ROOT_DIR"

echo "Installing forge deps..."
if [ -d "./lib/forge-std" ]; then
  if [ "$(ls -A ./lib/forge-std)" ]; then
    echo "forge deps already installed"
    echo "Skipping.."
	exit 0
  else
    echo "Dep directory found, but it's empty"
    echo "Cleaning up and installing deps.."
    rm -rf ./lib/forge-std
  fi
fi

forge install foundry-rs/forge-std@be5c649 --no-git