# ── Next.js Web Manager Dashboard Multi-Stage Dockerfile ─────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

# Copy workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/api-client packages/api-client
COPY apps/web apps/web

# Install monorepo dependencies
RUN pnpm install --frozen-lockfile

# Build dependencies and Next.js production bundle
RUN pnpm --filter @telecalling-crm/shared run build
RUN pnpm --filter @telecalling-crm/api-client run build
RUN pnpm --filter @telecalling-crm/web run build

# ── Production Runtime Stage ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache wget curl

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built web package
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000"]

