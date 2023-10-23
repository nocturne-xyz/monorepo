# Nocturne Monorepo

## Installation

- Run `yarn install`
- Run `git submodule init`
- Run `git submodule update`
- clone https://github.com/nocturne-xyz/protocol into the same dir as the monorepo
- Run `yarn copy-circuit-artifacts`

Database:
- Set up Postgres locally: `brew install postgresql; brew services start postgresql` for macOS
- Download Flyway CLI: https://documentation.red-gate.com/fd/command-line-184127404.html
- Install Java: https://www.java.com/en/download/
- Symlink your Flyway installation to run via CLI: `ln -s /<path>/<to>/<your>/<flyway>/<flyway> /usr/local/bin/flyway`
- Replace the following in flyway.conf:
    - `flyway.url=jdbc:postgresql://localhost:5432/nocturne`
    - `flyway.user=postgres`
    - `flyway.password=postgres`
- `createdb nocturne; psql -d nocturne`
- Run:
    - `CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';`
    - `GRANT ALL PRIVILEGES ON DATABASE nocturne TO postgres;`
    - `ALTER USER postgres CREATEROLE CREATEDB;`
- Run `flyway migrate -placeholders.nocturne_db_user_password=password` to verify successful installation and setup

## Build

- Run `yarn build`

## Run Tests

- Unit tests + contract invariant/fork tests: `yarn test:unit`
- E2E tests: `yarn link:protocol && yarn test:e2e`.

## Building the new docker container

build with 

```
docker build .
```

## Updating the new ECR
    
login to ECR with 

```
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors
```

then tag the image with 

```
docker tag local-image-name:latest 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:latest
```

then push with 

```
docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:latest
```