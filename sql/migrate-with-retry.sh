#!/usr/bin/env bash

max_attempts=3
delay=1
attempt=1

while [ $attempt -le $max_attempts ]
do
   echo "Attempt $attempt/$max_attempts"
   # Run the Flyway command with verbose logging (-X), capturing stdout and stderr separately
   output=$(flyway migrate -X -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" 2>&1)
   error=$(flyway migrate -X -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" 2>/dev/null)
   result=$?
   
   # Print standard output and error
   echo "Output: $output"
   echo "Error: $error"

   if [ $result -eq 0 ]
   then
     echo "Migration successful"
     exit 0
   else
     echo "Migration failed with status $result"
   fi

   echo "Migration failed, retrying in $delay seconds..."
   sleep $delay
   attempt=$(( $attempt + 1 ))
done

echo "Migration failed after $max_attempts attempts"
exit $result
