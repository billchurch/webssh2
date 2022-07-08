FROM node:16-alpine

WORKDIR /usr/src
COPY app/ /usr/src/
RUN npm install --production
EXPOSE 2222/tcp
ENTRYPOINT [ "/usr/local/bin/node", "index.js" ]
