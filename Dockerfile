# ═══════════════════════════════════════════════════════
# Ablox — Multi-stage Docker Build
# ═══════════════════════════════════════════════════════

# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build client + server ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production image ──
FROM node:22-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 ablox && \
    adduser --system --uid 1001 --ingroup ablox ablox

# Create logs and uploads directories
RUN mkdir -p /app/logs /app/uploads/avatars /app/uploads/media && \
    chown -R ablox:ablox /app/logs /app/uploads

# Copy only production artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy migration/schema files (needed for drizzle-kit push)
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Switch to non-root user
USER ablox

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use cluster mode for multi-core utilization
# CLUSTER_WORKERS env controls worker count (defaults to CPU count)
CMD ["node", "dist/cluster.cjs"]
