COMMIT_HASH=$(git rev-parse --short HEAD)
docker build -f ./Dockerfile ../../ -t nocturnelabs/bundler:$COMMIT_HASH