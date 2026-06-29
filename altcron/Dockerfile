FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY config.yaml ./

RUN mkdir -p data skills

EXPOSE 3000 3001

CMD ["node", "--loader", "tsx", "src/index.ts"]
