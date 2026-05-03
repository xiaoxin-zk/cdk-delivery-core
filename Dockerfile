# ── Base ──────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies ──────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# ── Builder ───────────────────────────────────────────
FROM deps AS builder
# Copy prisma schema first for better layer caching
COPY prisma ./prisma
RUN npx prisma generate
# Copy source and build
COPY . .
# Compile bootstrap script to JS (eliminates tsx runtime dependency)
RUN npx esbuild scripts/bootstrap-production.ts \
      --bundle --platform=node --format=cjs \
      --outfile=scripts/bootstrap-production.js \
      --external:@prisma/client --external:bcryptjs
RUN npm run build

# ── Runner (production) ──────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache curl

# Next.js standalone output (includes only traced node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma: client + CLI (for migrate deploy) + engines + schema & migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p node_modules/.bin \
    && ln -sf ../prisma/build/index.js node_modules/.bin/prisma \
    && chmod +x node_modules/.bin/prisma

# Compiled bootstrap script
COPY --from=builder /app/scripts/bootstrap-production.js ./scripts/

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "node scripts/bootstrap-production.js && exec node server.js"]
