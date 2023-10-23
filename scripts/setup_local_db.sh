#!/bin/bash

# Validates input
if [ -z "$1" ]
then
  echo "Usage: ./scripts/setup_local_db.sh </path/to/your/flyway/flyway>"
  exit 1
fi

FLYWAY_PATH=$1

# Step 1: install & start psql
brew install postgresql
brew services start postgresql

# Step 3: create symlink for Flyway CLI
ln -s $FLYWAY_PATH /usr/local/bin/flyway

# Step 5: create db and user
createdb nocturne
psql -d nocturne -c "CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';"
psql -d nocturne -c "GRANT ALL PRIVILEGES ON DATABASE nocturne TO postgres;"
psql -d nocturne -c "ALTER USER postgres CREATEROLE CREATEDB;"

# Step 6: run migrations
flyway migrate -placeholders.nocturne_db_user_password=password

# done
echo "Dev environment setup complete!✅"
