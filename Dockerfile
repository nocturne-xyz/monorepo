# Build the prover
FROM node as builder

WORKDIR /app

# install cargo & circom
COPY scripts scripts
RUN ./scripts/install-deps.sh

# install rapidsnark
# WORKDIR /rapidsnark
# RUN apt update && apt install build-essential libgmp-dev libsodium-dev nasm

# COPY ./rapidsnark/*.json .
# COPY ./rapidsnark/tasksfile.js .
# COPY ./rapidsnark/tools .
# COPY ./rapidsnark/.git ./.git
# COPY ./rapidsnark/depends ./depends
# COPY ./rapidsnark/src ./src

# RUN npm install
# RUN npx task createFieldSources
# RUN npx task buildProver

# setup monorepo
# COPY package.json .
# COPY tsconfig.json .
# COPY yarn.lock .
# COPY packages/subtree-updater packages/subtree-updater
# COPY packages/circuits packages/circuits

# RUN yarn install

CMD ["bash"]
