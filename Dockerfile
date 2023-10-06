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

RUN yarn install

RUN for component in bundler deposit-screener insertion-writer subtree-updater test-actor; do \
    yarn turbo run build --filter="@nocturne-xyz/$component" \
    # setup CLI using loop
    && cd /app/actors/$component \
    && npm i -g  \
    && cd /app; \
done

# note - this entrypoint is generally overridden in our ECS Task Definitions using the `container_definitions` field.
# see: https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html
ENTRYPOINT ["bundler-cli"]