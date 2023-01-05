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

    docker buildx build --platform linux/amd64 -t nocturne-base ..
else
nnoremap <leader>rh
	docker build -t nocturne-base ..
fi
