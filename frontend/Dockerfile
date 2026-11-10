# syntax=docker/dockerfile:1
# ==============================================================================
# ProctorNet Frontend — Multi-Stage Production Dockerfile (G-02)
# Stage 1 (builder): npm ci + vite build + brotli/gzip pre-compression
# Stage 2 (runner) : nginxinc/nginx-unprivileged:alpine serves pre-compressed
#                    static assets with immutable cache headers and reverse
#                    proxies /api and /socket.io to backend:4000.
# ==============================================================================

# --- Stage 1: Vite Builder + Pre-Compression ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# Build SPA (vite-plugin-compression2 already emits .gz and .br alongside assets)
RUN npm run build

# Ensure brotli tool is available for any asset that vite-plugin-compression2
# may have missed (e.g. index.html itself).
RUN apk add --no-cache brotli && \
    find /app/dist -type f \
      \( -name "*.html" -o -name "*.js" -o -name "*.css" \
         -o -name "*.svg" -o -name "*.json" -o -name "*.txt" \) | \
    while read f; do \
      [ ! -f "$f.gz" ] && gzip  -9 -k "$f"; \
      [ ! -f "$f.br" ] && brotli --best -k "$f"; \
    done || true

# --- Stage 2: Static Asset Server (unprivileged Nginx) ---
FROM nginxinc/nginx-unprivileged:1.25-alpine AS runner

USER nginx

# Copy built & pre-compressed SPA artifacts
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Nginx configuration: gzip_static + brotli_static, 1-year immutable cache, API reverse proxy
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
