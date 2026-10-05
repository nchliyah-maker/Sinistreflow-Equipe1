FROM node:22

WORKDIR /app

COPY . .
RUN npm install

ENV TZ=Europe/Paris

EXPOSE 3000

CMD ["node", "src/index.js"]
