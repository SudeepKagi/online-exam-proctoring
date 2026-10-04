# syntax=docker/dockerfile:1
# ==============================================================================
# ProctorNet Frontend — Multi-Stage Production Dockerfile (P9 Task 7)
# Stage 1: Build static SPA assets with Vite + brotli/gzip pre-compression
# Stage 2: Serve via unprivileged Alpine Nginx with immutable cache rules
# ==============================================================================

# --- Stage 1: Vite Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: Static Asset Server ---
FROM nginxinc/nginx-unprivileged:1.25-alpine AS runner

USER nginx

# Copy built SPA artifacts
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Custom internal Nginx configuration for unprivileged SPA serving
COPY --chown=nginx:nginx <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip & Brotli static serving
    gzip_static on;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Hashed static assets — 1 year immutable cache
    location ~* \.(?:css|js|woff2?|svg|png|jpe?g|webp|ico|avif)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # SPA routing fallback: index.html is never cached aggressively
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location = /healthz {
        return 200 "OK\n";
    }
}
EOF

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
