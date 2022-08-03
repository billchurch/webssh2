FROM node:16-alpine

RUN apk update && apk add bash

WORKDIR /usr/src
COPY app/ /usr/src/
RUN npm ci --audit=false --bin-links=false --fund=false
EXPOSE 2222/tcp
ENTRYPOINT [ "/usr/local/bin/node", "index.js" ]
