COMMIT_HASH=$(git rev-parse --short HEAD)

if [ ! -z "$IS_MOCK" ]; then
    docker push nocturnelabs/mock-subtree-updater:$COMMIT_HASH
    exit 0
fi

docker push nocturnelabs/subtree-updater:$COMMIT_HASH