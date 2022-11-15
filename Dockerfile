FROM node:19

ENV USER=flax
ENV UID=1001

RUN apt-get update && apt-get install -y build-essential libgmp-dev libsodium-dev nasm git && rm -rf /var/lib/apt/lists/*

# rapidsnark
RUN mkdir /rapidsnark
WORKDIR /rapidsnark
RUN git clone https://github.com/iden3/rapidsnark.git ./
RUN npm install
RUN git submodule init
RUN git submodule update
RUN npx task createFieldSources
RUN npx task buildProver

ENV NPM_CONFIG_PREFIX=/home/app/node/.npm-global
RUN corepack enable
RUN npm install -g snarkjs@latest

ENV PATH=${PATH}:/home/app/node/.npm-global/bin

COPY  .          /home/monorepo
WORKDIR /home/monorepo
