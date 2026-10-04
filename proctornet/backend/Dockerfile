# ==============================================================================
# ProctorNet Backend — Production Multi-Stage Dockerfile (P9 Task 7)
# Node 22 LTS, non-root user, tini init, Prisma generated, read-only root friendly
# ==============================================================================

# --- Stage 1: Dependency & Prisma Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Native compilation prerequisites for bcrypt / sharp
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# Prune development packages for minimal attack surface and size
RUN npm prune --omit=dev

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

# Install tini for clean signal forwarding and zombie reaping, and tools for healthcheck
RUN apk add --no-cache tini wget curl

ENV NODE_ENV=production
ENV UV_THREADPOOL_SIZE=64
ENV PORT=5000

# Create dedicated non-root application user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S proctornet -u 1001 -G nodejs

# Copy pruned dependencies, generated Prisma client, and application source
COPY package.json package-lock.json ./
COPY --from=builder --chown=proctornet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=proctornet:nodejs /app/prisma ./prisma
COPY --chown=proctornet:nodejs src ./src

# Create tmp directory with write permissions for tmpfs mounts
RUN mkdir -p /app/tmp && chown -R proctornet:nodejs /app

USER proctornet

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:5000/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=2048", "src/app.js"]
