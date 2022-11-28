#!/bin/bash
set -u

echo "checking if cargo is installed..."
CARGO_VERSION=$(cargo --version | head -n 1)
if ! type "$?" >/dev/null 2>&1; then
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