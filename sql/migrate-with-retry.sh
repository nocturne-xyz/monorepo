#!/usr/bin/env bash

max_attempts=3
delay=5 # Delay time in seconds
attempt=1
output_log="migrate_output.log"

while [ $attempt -le $max_attempts ]; do
   echo "Attempt $attempt/$max_attempts"
   
   # Run the Flyway command with verbose logging (-X), and redirect all output to a log file
   flyway migrate -X -placeholders.nocturne_db_user_password="$NOCTURNE_DB_USER_PASSWORD" > "$output_log" 2>&1
   result=$?
   
   # Sleep for a while to ensure all output is written to the log file
   sleep $delay
   
   # Check if the output log file exists and is not empty
   if [ -s "$output_log" ]; then
     # Read the full output from the log file
     output=$(cat "$output_log")
     
     # Print the output
     echo "Output:"
     echo "$output"
   else
     echo "No output was captured in the log file."
   fi

   # Check the result and decide if we should continue
   if [ $result -eq 0 ]; then
     echo "Migration successful"
     exit 0
   else
     echo "Migration failed with status $result"
   fi

   # If the migration failed, wait before retrying
   echo "Migration failed, retrying in $delay seconds..."
   sleep $delay
   attempt=$(( attempt + 1 ))
done

# If all attempts fail, print a message and exit with the last error code
echo "Migration failed after $max_attempts attempts"
exit $result
