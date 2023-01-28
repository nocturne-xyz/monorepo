FROM node:18.12.1

WORKDIR /app

COPY scripts scripts

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarn .yarn
COPY .yarnrc.yml .
COPY packages/subtree-updater packages/subtree-updater

RUN corepack enable
RUN yarn install

WORKDIR /app/packages/circuits

WORKDIR /app/packages/subtree-updater

RUN yarn build
RUN npm i -g

WORKDIR /app

ENTRYPOINT ["subtree-updater-cli"]
