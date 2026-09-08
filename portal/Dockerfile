FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
