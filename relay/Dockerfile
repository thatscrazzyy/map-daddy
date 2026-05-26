FROM node:20-slim

WORKDIR /app

COPY relay/package*.json ./
RUN npm ci --omit=dev

COPY relay/server.js ./

ENV PORT=8080
CMD ["npm", "start"]
