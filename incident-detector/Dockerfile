FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY .npmrc ./
COPY package.json ./
RUN npm install --only=production && chown -R node:node /usr/src/app

COPY --chown=node:node src ./src

EXPOSE 5000

USER node

CMD ["node", "src/index.js"]
