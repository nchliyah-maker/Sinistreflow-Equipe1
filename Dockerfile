# Image de production de SinistreFlow
FROM node:22-alpine

ENV NODE_ENV=production
ENV TZ=Europe/Paris

WORKDIR /app

# Dépendances de production uniquement (pas Jest, Supertest ni Playwright).
# Copiées avant le code : la couche reste en cache tant que package-lock.json ne change pas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Uniquement ce dont l'application a besoin pour tourner
COPY src ./src
COPY public ./public
COPY migrations ./migrations

# Utilisateur non privilégié fourni par l'image officielle
USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
