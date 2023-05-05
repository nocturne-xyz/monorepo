FROM node:18.12.1

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarn .yarn
COPY .yarnrc.yml .
COPY packages/config/configs ./configs
COPY packages/deposit-screener packages/deposit-screener

RUN yarn install

WORKDIR /app/packages/deposit-screener
RUN yarn build
RUN npm i -g

ENTRYPOINT ["screener-cli"]