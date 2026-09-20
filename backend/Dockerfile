FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build || true

EXPOSE 3001

CMD ["node", "dist/src/server.js"]
