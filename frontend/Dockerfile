FROM node:24-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /app/shared/
# Cadena vacía: la API se consulta en el mismo origen que la página.
ENV VITE_API_URL="" VITE_BIBLIOTECA_MOCK=false
RUN npm run build

FROM caddy:2-alpine
COPY deployment/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
EXPOSE 80 443
