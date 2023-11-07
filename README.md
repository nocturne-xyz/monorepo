# Nocturne Monorepo

## Installation

- Run `yarn install`
- Run `git submodule init`
- Run `git submodule update`

### IF TESTING AGAINST A PARTICULAR NETWORK
- Run `yarn checkout-circuit-artifacts:$NETWORK_NAME` to pull circuit artifacts for the given network

### IF TESTING LOCAL PROTOCOL CHANGES
- clone https://github.com/nocturne-xyz/protocol into the same dir as the monorepo
- Run `yarn copy-circuit-artifacts`

## Build

- Run `yarn build`

## Run Tests

- Unit tests + contract invariant/fork tests: `yarn test:unit`
- E2E tests: `yarn link:protocol && yarn test:e2e`.

## Building the new docker container

checkout circuit artifacts for the network you're building for

```
yarn checkout-circuit-artifacts:NETWORK_NAME
```

build containers for the network you're building for

```
yarn build:docker-actors:NETWORK_NAME
yarn build:docker-updater:NETWORK_NAME
```

push containers for the network you're building for
```
yarn build:push-actors:NETWORK_NAME
yarn build:push-updater:NETWORK_NAME
```


## Updating the new ECR

login to ECR with 

```
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors
```

checkout 

then tag the image with 

```
docker tag local-image-name:latest 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:latest
```

then push with 

```
docker push 714567495486.dkr.ecr.us-east-2.amazonaws.com/nocturne-actors:latest
```