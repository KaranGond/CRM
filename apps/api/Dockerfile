# ── NestJS API Production Multi-Stage Dockerfile ─────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# System dependencies for native modules (bcrypt, prisma)
RUN apk add --no-cache openssl python3 make g++

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

# Copy workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/api-client packages/api-client
COPY apps/api apps/api

# Install monorepo dependencies
RUN pnpm install --frozen-lockfile

# Build shared package, generate Prisma client, and compile NestJS API
RUN pnpm --filter @telecalling-crm/shared run build
RUN pnpm --filter @telecalling-crm/api run db:generate
RUN pnpm --filter @telecalling-crm/api run build

# ── Production Runtime Stage ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime dependencies (wget for healthcheck, openssl for prisma engine)
RUN apk add --no-cache wget curl openssl

ENV NODE_ENV=production
ENV PORT=4000

# Copy root workspace and build artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]

