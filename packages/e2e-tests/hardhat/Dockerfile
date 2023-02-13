FROM node:18
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm i

COPY run.sh .

COPY hardhat.config.ts .

EXPOSE 8545

CMD ["/bin/sh", "-C", "run.sh"]