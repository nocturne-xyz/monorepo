COMMIT_HASH=$(git rev-parse --short HEAD)
docker push nocturnelabs/test-actor:$COMMIT_HASH