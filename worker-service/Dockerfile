FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy package files and install production dependencies. Use package*.json
# so a package-lock.json will be used when present (npm ci requires it).
COPY package*.json ./
RUN npm ci --only=production && chown -R node:node /usr/src/app

# Copy source and set ownership for the runtime user
COPY --chown=node:node src ./src

EXPOSE 4000

# Run as non-root user
USER node

CMD ["node", "src/index.js"]
