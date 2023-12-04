#!/usr/bin/env bash

max_attempts=3
delay=30
attempt=1
output_log="migrate_output.log"

while [ $attempt -le $max_attempts ]; do
   echo "Attempt $attempt/$max_attempts"
   
   # Run the Flyway command with verbose logging (-X)
   flyway migrate -X -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" &> "$output_log"
   result=$?
   
   # Immediately echo the output if there is any
   cat "OUTPUT LOG: $output_log"

   # Check if Flyway migration was successful
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
