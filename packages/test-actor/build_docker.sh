COMMIT_HASH=$(git rev-parse --short HEAD)
docker build -f ./Dockerfile ../../ -t nocturnelabs/test-actor:$COMMIT_HASH