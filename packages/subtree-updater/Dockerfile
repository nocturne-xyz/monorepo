FROM node:16
COPY --from=rapidsnark /rapidsnark /rapidsnark

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock .
COPY .yarnrc.yml .
COPY packages/subtree-updater packages/subtree-updater
COPY packages/circuits packages/circuits

RUN yarn install

WORKDIR /app/packages/circuits

RUN ./scripts/download_big_ptau.sh
RUN ./scripts/subtreeupdate/build.sh
RUN ./scripts/build_witness_generator.sh

WORKDIR /app

RUN yarn build
RUN npm i -g

CMD ["subtree-updater-cli"]
