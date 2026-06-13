FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy registry config and package manifest, then install from public npm
COPY .npmrc ./
COPY package.json ./
RUN npm install --only=production && chown -R node:node /usr/src/app

# Copy source and set ownership for the runtime user
COPY --chown=node:node src ./src

EXPOSE 4000

# Run as non-root user
USER node

CMD ["node", "src/index.js"]
