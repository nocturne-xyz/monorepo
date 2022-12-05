#!/bin/bash
ROOT_DIR="$SCRIPT_DIR/../../../"
RAPIDSNARK_DIR="$ROOT_DIR/rapidsnark"

echo "cloning rapdisnark..."
pushd $ROOT_DIR
git submodule update
popd

echo "installing rapidsnark dependencies..."
sudo apt install build-essential libgmp-dev libsodium-dev nasm nlohmann-json3-dev

echo "installing rapidsnark..."
pushd $RAPIDSNARK_DIR
npm install
git submodule init
git submodule update
npx task createFieldSources
npx task buildProver
popd
