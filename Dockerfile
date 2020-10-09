FROM node:alpine

WORKDIR /usr/src
COPY app/ /usr/src/
RUN npm install --production
EXPOSE 2222
ENTRYPOINT [ "/usr/local/bin/node", "index.js" ]
