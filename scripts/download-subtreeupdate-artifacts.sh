SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
cd $SCRIPT_DIR/..

aws s3 cp 's3://subtreeupdate-circuit-artifacts/v0.1.0-<TODO_COMMIT_HASH>-06-9-2023/' ./circuit-artifacts/subtreeupdate
