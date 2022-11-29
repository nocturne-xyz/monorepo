#!/bin/bash

echo "installing rapidsnark dependencies..."
sudo apt install build-essential libgmp-dev libsodium-dev install nasm nlohmann-json3-dev

echo "installing rapidsnark dependencies..."
npm install
git submodule init
git submodule update
npx task createFieldSources
npx task buildProver
