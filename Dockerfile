FROM node:12

WORKDIR /usr/bin/executa

COPY package.json .
RUN npm install

COPY . .
RUN npm run build:node

CMD node dist/lib/cli serve --stdio
