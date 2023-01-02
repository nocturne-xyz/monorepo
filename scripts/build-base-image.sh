#!/bin/bash

set -e

cd "$(dirname "$0")"
git submodule init
git submodule update

pushd ../rapidsnark
git submodule init
git submodule update
popd
if [[ $(uname -m) == 'arm64' ]]; then
	echo "dected arm64, building using docker buildx..."

	docker build -t nocuturne-base ..
	# docker buildx build --progress=plain --platform linux/amd64 . 
else
	docker build -t nocturne-base ..
fi
