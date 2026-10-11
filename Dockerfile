FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/
COPY public/ ./public/

RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["node", "src/index.js"]
