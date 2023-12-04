#!/usr/bin/env bash

max_attempts=3
delay=1
attempt=1

while [ $attempt -le $max_attempts ]
do
   echo "Attempt $attempt/$max_attempts"
   # Capture both stdout and stderr in a variable
   output=$(flyway migrate -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" 2>&1)
   result=$?
   
   # Print the output whether it's a success or an error
   echo "$output" 

   if [ $result -eq 0 ]
   then
     echo "Migration successful"
     exit 0
   else
     echo "Migration failed with status $result"
     # Print error message if the command fails
     echo "Error: $output"
   fi

   echo "Migration failed, retrying in $delay seconds..."
   sleep $delay
   attempt=$(( $attempt + 1 ))
done

echo "Migration failed after $max_attempts attempts"
exit $result
