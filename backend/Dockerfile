FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY shared /app/shared
COPY init-db /app/init-db
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
