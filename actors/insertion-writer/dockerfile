FROM node:18.12.1


WORKDIR /app
RUN corepack enable

# install foundry
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="$PATH:/root/.cargo/bin"
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="$PATH:/root/.foundry/bin"
RUN foundryup -C e15e33a

# copy over entire monorepo
COPY . .

# install deps & build
RUN yarn install
RUN yarn turbo run build --filter="@nocturne-xyz/insertion-writer..."

# setup CLI
WORKDIR /app/actors/insertion-writer
RUN npm i -g 

ENTRYPOINT ["insertion-writer-cli"]