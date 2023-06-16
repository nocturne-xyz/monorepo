COMMIT_HASH=$(git rev-parse --short HEAD)
docker build -f ./Dockerfile ../../ -t nocturnelabs/deposit-screener:$COMMIT_HASH