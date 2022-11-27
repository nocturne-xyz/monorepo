#!/bin/bash
set -u

echo "checking if cargo is installed..."
CARGO_VERSION=$(cargo --version | head -n 1)
if [ $? -eq 0 ]
then
	echo "found cargo version $CARGO_VERSION"
	echo ""
else
	echo "cargo not found. installing via rustup..."
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
	source ~/.bashrc
	CARGO_VERSION=$(cargo --version | head -n 1)
	echo "installed cargo version $CARGO_VERSION"
fi

echo "checking if circom is installed..."
CIRCOM_VERSION=$(circom --version | cut -d " " -f3)
if [ $? -eq 0 ]
then
	echo "found circom version $CIRCOM_VERSION"
	echo ""
else
	echo "circom not found. installing..."
	git clone https://github.com/iden3/circom.git
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
	GSED_VERSION=$(gsed --version | head -n 1)
	if [ $? -eq 0 ]
	then
		echo "found gsed version $GSED_VERSION"
		echo ""
	else
		echo "gsed not found. installing..."
		brew install gnu-sed
		source ~/.bashrc
		GSED_VERSION=$(gsed --version | head -n 1)
		echo "installed gsed version $GSED_VERSION"
	fi
fi