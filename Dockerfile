# Use debian:bookworm-slim runtime as a parent image
FROM debian:bookworm-slim

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN apt-get update \
    && apt-get install -y curl \
    && apt-get -y autoclean

# nvm environment variables
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 22

RUN mkdir -p $NVM_DIR

# install nvm
# https://github.com/creationix/nvm#install-script
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN echo "source $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default" | bash

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json index.js ./

# Install production dependencies
# RUN npm install --production
RUN npm i --audit=false --bin-links=false --fund=false --production

COPY app/ ./app/

# Environment-first approach: No config.json needed
# All configuration via environment variables
# Uncomment the next line if you want to include a config.json template
# COPY config.json.sample config.json

# Set default environment variables
ENV WEBSSH2_LISTEN_IP=0.0.0.0
ENV WEBSSH2_LISTEN_PORT=2222
ENV WEBSSH2_SSH_PORT=22
ENV WEBSSH2_SSH_TERM=xterm-256color
ENV WEBSSH2_SSH_ALGORITHMS_PRESET=modern
ENV WEBSSH2_HEADER_BACKGROUND=green
ENV WEBSSH2_SESSION_NAME=webssh2.sid
ENV WEBSSH2_OPTIONS_CHALLENGE_BUTTON=true
ENV WEBSSH2_OPTIONS_ALLOW_REAUTH=true
ENV WEBSSH2_OPTIONS_ALLOW_RECONNECT=true
ENV WEBSSH2_OPTIONS_ALLOW_REPLAY=true
ENV WEBSSH2_OPTIONS_AUTO_LOG=false

# HTTP CORS - default to restrictive (override in deployment)
ENV WEBSSH2_HTTP_ORIGINS="*:*"

# Legacy PORT support (maps to WEBSSH2_LISTEN_PORT)
ENV PORT=2222

# Debug configuration (empty by default)
ENV DEBUG=

# Make port 2222 available to the world outside this container
EXPOSE 2222

# Run the app when the container launches
CMD ["npm", "start"]