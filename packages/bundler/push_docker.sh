COMMIT_HASH=$(git rev-parse --short HEAD)
docker push nocturnelabs/bundler:$COMMIT_HASH