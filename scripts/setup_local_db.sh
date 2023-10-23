#!/bin/bash

# Validates input
if [ -z "$1" ]
then
  echo "Usage: ./setup-dev.sh /path/to/your/flyway/flyway"
  exit 1
fi

FLYWAY_PATH=$1

# Step 1: Install PostgreSQL
brew install postgresql

# Step 2: Start PostgreSQL
brew services start postgresql

# Step 3: Create symlink for Flyway CLI
ln -s $FLYWAY_PATH /usr/local/bin/flyway

# Step 5: Create db and user
createdb nocturne
psql -d nocturne -c "CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';"
psql -d nocturne -c "GRANT ALL PRIVILEGES ON DATABASE nocturne TO postgres;"
psql -d nocturne -c "ALTER USER postgres CREATEROLE CREATEDB;"

# Step 6: Run migrations
flyway migrate -placeholders.nocturne_db_user_password=password

# Done
echo "Dev environment setup complete."
