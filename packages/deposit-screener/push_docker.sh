COMMIT_HASH=$(git rev-parse --short HEAD)
docker push nocturnelabs/deposit-screener:$COMMIT_HASH