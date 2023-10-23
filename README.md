# Nocturne Monorepo

## Installation

- Run `yarn install`
- Run `git submodule init`
- Run `git submodule update`
- clone https://github.com/nocturne-xyz/protocol into the same dir as the monorepo
- Run `yarn copy-circuit-artifacts`

Database:
- Install Flyway CLI: https://documentation.red-gate.com/fd/command-line-184127404.html
- Install Java: https://www.java.com/en/download/
- Run `chmod +x ./scripts/setup_local_db.sh; ./scripts/setup_local_db.sh </path/to/your/flyway/flyway>`

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