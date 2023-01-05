# Build the prover
FROM node as builder
RUN corepack enable
RUN yarn set version latest

WORKDIR /app

# install cargo & circom
COPY scripts scripts
RUN ./scripts/install-deps.sh

# install rapidsnark
RUN mkdir rapidsnark
WORKDIR /app/rapidsnark

RUN apt update -y && apt install -y build-essential libgmp-dev libsodium-dev nasm

COPY ./rapidsnark/*.json .
COPY ./rapidsnark/tasksfile.js .
COPY ./rapidsnark/tools .
COPY ./rapidsnark/.git ./.git
COPY ./rapidsnark/depends ./depends
COPY ./rapidsnark/src ./src

RUN npm install
RUN npx task createFieldSources
RUN npx task buildProver

# setup monorepo
WORKDIR /app

COPY types types
COPY .gitattributes .
COPY .gitignore .
COPY .gitmodules .
COPY .yarnrc.yml .
COPY .yarn .yarn
COPY foundry.toml .
COPY tsconfig.json .
COPY turbo.json .
COPY package.json .
COPY yarn.lock .
COPY packages packages
COPY fixtures fixtures
COPY circuit-artifacts circuit-artifacts

RUN yarn install

CMD ["bash"]
