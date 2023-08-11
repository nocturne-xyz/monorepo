COMMIT_HASH=$(git rev-parse --short HEAD)

docker push "nocturnelabs/bundler:$COMMIT_HASH"
docker push "nocturnelabs/deposit-screener:$COMMIT_HASH"
docker push "nocturnelabs/test-actor:$COMMIT_HASH"
docker push "nocturnelabs/subtree-updater:$COMMIT_HASH"
