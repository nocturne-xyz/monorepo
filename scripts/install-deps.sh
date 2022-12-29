#!/usr/bin/env bash

set -u

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
echo "checking if cargo is installed..."
CARGO_VERSION=$(cargo --version | head -n 1)
if ! command "cargo --version" >/dev/null 2>&1; then
	echo "cargo not found. installing via rustup..."
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
	source ~/.bashrc
	CARGO_VERSION=$(cargo --version | head -n 1)
	echo "installed cargo version $CARGO_VERSION"
else
	echo "found cargo version $CARGO_VERSION"
	echo ""
fi

echo "checking if circom 2.1.2 is installed..."
CIRCOM_VERSION=$(circom --version | cut -d " " -f3)
if [ $CIRCOM_VERSION == "2.1.2" ]
then
	echo "found circom version 2.1.2"
	echo ""
else
	echo "circom not found. installing..."
	rm -rf circom
	git clone https://github.com/iden3/circom.git --branch v2.1.2
	pushd circom
	cargo build --release
	cargo install --path circom
	popd
	rm -rf circom
	CIRCOM_VERSION=$(circom --version | cut -d " " -f3)
	echo "installed circom version $CIRCOM_VERSION"
	echo ""
fi

if [[ $OSTYPE == 'darwin'* ]]; then
	echo "macOS detected..."

	echo "checking if homebrew is installed..."
	BREW_VERSION=$(brew --version | head -n 1)
	if [ $? -eq 0 ]
	then
		echo "found brew version $CARGO_VERSION"
		echo ""
	else
		echo "homebrew not found. installing..."
		curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh
		source ~/.bashrc
		BREW_VERSION=$(brew --version | head -n 1)
		echo "installed brew version $BREW_VERSION"
	fi

	echo "checking if gsed is installed..."
	if ! type "$?" >/dev/null 2>&1; then
		echo "gsed not found. installing..."
		brew install gnu-sed
		source ~/.bashrc
		GSED_VERSION=$(gsed --version | head -n 1)
		echo "installed gsed version $GSED_VERSION"
	else
		echo "found gsed version $GSED_VERSION"
		echo ""
	fi
fi