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
COPY --chown=nginx:nginx <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 15M;

    # Serve pre-compressed assets (.gz / .br) automatically
    gzip_static on;

    # Security headers
    add_header X-Frame-Options        "DENY"                             always;
    add_header X-Content-Type-Options "nosniff"                          always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin"  always;

    # Content-hashed Vite assets: 1-year immutable browser cache
    location ~* \.(?:css|js|woff2?|svg|png|jpe?g|webp|ico|avif)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    # Proxy WebSocket / Socket.io requests to backend
    location /socket.io/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    # SPA routing fallback: index.html never aggressively cached
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location = /healthz {
        access_log off;
        return 200 "OK\n";
    }
}
EOF

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
