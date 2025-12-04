# Use node:22-alpine as a parent image for smallest size and best security
FROM node:22-alpine

# Alpine uses ash shell by default, which is sufficient for our needs
# No need to install bash unless specifically required

# Set the working directory in the container
WORKDIR /srv/webssh2

# Copy package.json and package-lock.json (if available)
COPY package*.json index.js ./

# Install production dependencies using npm ci for reproducible builds
# Note: Using npm ci requires package-lock.json to be present
RUN npm ci --audit=false --fund=false --omit=dev

COPY app/ ./app/

# Environment-first approach: No config.json needed
# All configuration via environment variables
# Uncomment the next line if you want to include a config.json template
# COPY config.json.sample config.json

# Set default environment variables (consolidated per S6471)
ENV WEBSSH2_LISTEN_IP=0.0.0.0 \
    WEBSSH2_LISTEN_PORT=2222 \
    WEBSSH2_SSH_PORT=22 \
    WEBSSH2_SSH_TERM=xterm-256color \
    WEBSSH2_SSH_ALGORITHMS_PRESET=modern \
    WEBSSH2_HEADER_BACKGROUND=green \
    WEBSSH2_SESSION_NAME=webssh2.sid \
    WEBSSH2_OPTIONS_CHALLENGE_BUTTON=true \
    WEBSSH2_OPTIONS_ALLOW_REAUTH=true \
    WEBSSH2_OPTIONS_ALLOW_RECONNECT=true \
    WEBSSH2_OPTIONS_ALLOW_REPLAY=true \
    WEBSSH2_OPTIONS_AUTO_LOG=false \
    WEBSSH2_HTTP_ORIGINS="*:*" \
    PORT=2222 \
    DEBUG=

# Make port 2222 available to the world outside this container
EXPOSE 2222

# Run the app when the container launches
CMD ["npm", "start"]
