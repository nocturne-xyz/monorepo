FROM node:16

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY packages/bundler packages/bundler

RUN yarn install

WORKDIR /app/packages/bundler
RUN yarn build
RUN npm i -g

CMD ["bundler-cli"]