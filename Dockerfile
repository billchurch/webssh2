# Use an official Node.js 6.9.1 runtime as a parent image
FROM node:6.9.1-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the current directory contents into the container
COPY . .

# Set environment variables
ENV PORT=2222
ENV DEBUG=

# Make port 2222 available to the world outside this container
EXPOSE 2222

# Run the app when the container launches
CMD ["npm", "start"]