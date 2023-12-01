
SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOT_DIR="$SCRIPT_DIR/../"
NETWORK_NAME=$1

if [ -z "$NETWORK_NAME" ]
then
	echo "no network name given"
	exit 1
else
	echo "building and pushing all images for network '$NETWORK_NAME'"
fi

yarn build:docker-actors:$NETWORK_NAME &
yarn build:docker-updater:$NETWORK_NAME &
wait

yarn checkout-circuit-artifacts:$NETWORK_NAME
./scripts/authenticate_ecr.sh

yarn push:docker-actors:$NETWORK_NAME &
yarn push:docker-updater:$NETWORK_NAME &
wait
