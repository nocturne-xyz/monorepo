FROM node:18.12.1

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarn .yarn
COPY .yarnrc.yml .
COPY packages/test-actor packages/test-actor

RUN yarn install

WORKDIR /app/packages/test-actor
RUN yarn build
RUN npm i -g

COPY packages/config/configs /app/configs

ENTRYPOINT ["test-actor-cli"]