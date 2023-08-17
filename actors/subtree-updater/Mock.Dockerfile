FROM node:18.12.1

WORKDIR /app

RUN corepack enable

# install foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="$PATH:/root/.foundry/bin"
RUN foundryup

# copy over entire monorepo
COPY . .

# install deps & build
RUN yarn install

# build
WORKDIR /app
RUN yarn turbo run build --filter="@nocturne-xyz/subtree-updater..."


# setup CLI
WORKDIR /app/actors/subtree-updater
RUN npm i -g 

ENTRYPOINT ["subtree-updater-cli"]
