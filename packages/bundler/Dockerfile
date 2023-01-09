FROM node:16

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarn .yarn
COPY .yarnrc.yml .
COPY packages/bundler packages/bundler

RUN yarn install

WORKDIR /app/packages/bundler
RUN yarn build
RUN npm i -g

ENTRYPOINT ["bundler-cli"]