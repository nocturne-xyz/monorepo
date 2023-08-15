COMMIT_HASH=$(git rev-parse --short HEAD)

# pushes docker containers for offchain actors
# takes one option:
#   -o (optional): push only the indiciated actor. can be one of `subtree-updater`, `bundler`, `deposit-screener`, or `test-actor`

usage() { echo "usage: $0 [-p <'mock' | 'rapidsnark'> -o <'subtree-updater' | 'bundler' | 'deposit-screener' | 'test-actor'>]" 1>&2; }

while getopts ":p:o:" o; do
    case "${o}" in
        o)
            PUSH_ONLY=${OPTARG}
            ((PUSH_ONLY == "subtree-updater" || PUSH_ONLY == "bundler" || PUSH_ONLY == "deposit-screener" || PUSH_ONLY == "test-actor")) || (usage && exit 1)
            ;;
        *)
            SUBTREE_UPDATER_PROVER_MODE="mock"
            ;;
    esac
done


if [ "$PUSH_ONLY" == "subtree-updater" ]; then
    PUSH_SUBTREE_UPDATER=true
elif [ "$PUSH_ONLY" == "bundler" ]; then
    PUSH_BUNDLER=true
elif [ "$PUSH_ONLY" == "deposit-screener" ]; then
    PUSH_DEPOSIT_SCREENER=true
elif [ "$PUSH_ONLY" == "test-actor" ]; then
    PUSH_TEST_ACTOR=true
else
    PUSH_SUBTREE_UPDATER=true
    PUSH_BUNDLER=true
    PUSH_DEPOSIT_SCREENER=true
    PUSH_TEST_ACTOR=true
fi


if [ "$PUSH_BUNDLER" == "true" ]; then
	echo "pushing bundler..."
	docker push "nocturnelabs/bundler:$COMMIT_HASH"
else
	echo "skipping bundler..."
fi

if [ "$PUSH_DEPOSIT_SCREENER" == "true" ]; then
	docker push "nocturnelabs/deposit-screener:$COMMIT_HASH"
else 
	echo "skipping deposit-screener..."
fi

if [ "$PUSH_TEST_ACTOR" == "true" ]; then
	docker push "nocturnelabs/test-actor:$COMMIT_HASH"
else 
	echo "skipping test-actor..."
fi

if [ "$PUSH_SUBTREE_UPDATER" == "true" ]; then
	docker push "nocturnelabs/subtree-updater:$COMMIT_HASH"
else 
	echo "skipping subtree-updater..."
fi
