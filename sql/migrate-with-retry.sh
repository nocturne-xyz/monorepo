#!/usr/bin/env bash

# note - this is necessary for local dev and should not really be necessary for deployed environments
#  this is here because even though in docker compose you can provide `depends_on` the postgres container
#  will start up and be look ready but the postgres process will not be ready to accept connections

max_attempts=3
delay=1
attempt=1

while [ $attempt -le $max_attempts ]
do
   echo "Attempt $attempt/$max_attempts"
   # Capture both stdout and stderr in a variable
   output=$(flyway migrate -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" 2>&1)
   result=$?
   
   echo "$output"  # Print the output whether it's a success or an error
   echo "$result"

   if [ $result -eq 0 ]
   then
     echo "Migration successful"
     exit 0
   else
     echo "Migration failed with status $result, check the output above."
   fi

   echo "Migration failed, retrying in $delay seconds..."
   sleep $delay
   attempt=$(( $attempt + 1 ))
done

echo "Migration failed after $max_attempts attempts"
exit $result