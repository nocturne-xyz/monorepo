FROM node:18.12.1

RUN apt update -y && apt install -y build-essential libgmp-dev libsodium-dev nasm nlohmann-json3-dev

COPY --from=rapidsnark /rapidsnark /rapidsnark

WORKDIR /app

COPY scripts scripts

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarn .yarn
COPY .yarnrc.yml .
COPY packages/subtree-updater packages/subtree-updater
COPY packages/circuits packages/circuits
COPY circuit-artifacts circuit-artifacts

RUN corepack enable
RUN yarn install

WORKDIR /app/packages/circuits

RUN ./scripts/build_witness_generator.sh

WORKDIR /app/packages/subtree-updater

RUN yarn build
RUN npm i -g

WORKDIR /app

ENTRYPOINT ["subtree-updater-cli"]
