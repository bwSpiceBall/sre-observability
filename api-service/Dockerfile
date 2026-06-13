# Lightweight Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Install dependencies from public npm registry
COPY .npmrc ./
COPY package.json ./
RUN npm install --only=production && chown -R node:node /usr/src/app

# Copy source and set ownership for the runtime user
COPY --chown=node:node src ./src

# Expose port configured by env (default 3000)
EXPOSE 3000

# Run as non-root for production-like behavior
USER node

CMD ["node", "src/index.js"]
