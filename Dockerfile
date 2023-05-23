# syntax = docker/dockerfile:1
# This Dockerfile is only used for deploying to fly.io.
# See docker-compose.yml for the dev environment

# This should match the version in docker-compose.yml
ARG NODE_VERSION=11.4.0
FROM node:${NODE_VERSION} AS build

# Node.js app lives here
WORKDIR /app

# Copy application code
COPY . .

# Install node modules
RUN npm ci --production

FROM node:${NODE_VERSION}-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

LABEL fly_launch_runtime="Node.js"

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080
CMD [ "npm", "run", "start" ]
