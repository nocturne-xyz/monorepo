COMMIT_HASH=$(git rev-parse --short HEAD)

docker tag nocturnelabs/bundler:dev "nocturnelabs/bundler:$COMMIT_HASH"
docker tag nocturnelabs/deposit-screener:dev "nocturnelabs/deposit-screener:$COMMIT_HASH"
docker tag nocturnelabs/subtree-updater:dev "nocturnelabs/subtree-updater:$COMMIT_HASH"

docker push "nocturnelabs/bundler:$COMMIT_HASH"
docker push "nocturnelabs/deposit-screener:$COMMIT_HASH"
docker push "nocturnelabs/subtree-updater:$COMMIT_HASH"
