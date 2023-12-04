#!/usr/bin/env bash

max_attempts=3
delay=5 # Adjust the delay as necessary
attempt=1

while [ $attempt -le $max_attempts ]; do
   echo "Attempt $attempt/$max_attempts"
   
   # Run the Flyway command with verbose logging (-X)
   flyway migrate -X -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" > migrate_output.log 2>&1
   result=$?
   
   # Wait a bit to ensure all output is flushed
   sleep $delay
   
   # Read the full output from the log file
   output=$(<migrate_output.log)
   
   # Print the output
   echo "Output: $output"

   if [ $result -eq 0 ]; then
     echo "Migration successful"
     exit 0
   else
     echo "Migration failed with status $result"
   fi

   echo "Migration failed, retrying in $delay seconds..."
   sleep $delay
   attempt=$(( attempt + 1 ))
done

echo "Migration failed after $max_attempts attempts"
exit $result
