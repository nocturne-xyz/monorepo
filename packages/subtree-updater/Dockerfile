FROM node

COPY --from=rapidsnark /rapidsnark /rapidsnark

WORKDIR /app
COPY scripts scripts
RUN scripts/install-deps.sh

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

WORKDIR /app

RUN yarn build
RUN npm i -g

CMD ["subtree-updater-cli"]
