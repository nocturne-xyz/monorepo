SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
NETWORK_NAME=$1

if [ -z "$NETWORK_NAME" ]
then
	echo "no network name given"
	exit 1
else
	echo "checking out circuit artifacts for network '$NETWORK_NAME'"
fi

aws s3 cp s3://actor-circuit-artifacts-$NETWORK_NAME/ ./circuit-artifacts --recursive
