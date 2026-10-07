FROM node:22-alpine

ENV NODE_ENV=production
ENV TZ=Europe/Paris

WORKDIR /app

# dépendances de production uniquement
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY migrations ./migrations

USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
