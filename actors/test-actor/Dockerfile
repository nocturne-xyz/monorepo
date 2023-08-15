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
RUN yarn turbo run build --filter="@nocturne-xyz/test-actor..."

# setup CLI
WORKDIR /app/actors/test-actor
RUN npm i -g 

ENTRYPOINT ["test-actor-cli"]