# ---- stage 1: build ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

# monorepo root
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json .npmrc ./

# shared packages
COPY packages/shared/package.json packages/shared/
COPY packages/auth-core/package.json packages/auth-core/

# www app
COPY apps/www/package.json apps/www/

RUN pnpm install --frozen-lockfile

# source code
COPY packages/shared packages/shared/
COPY packages/auth-core packages/auth-core/
COPY apps/www apps/www/

RUN pnpm --filter @inftkr/shared build
RUN pnpm --filter @inftkr/auth-core build
RUN pnpm --filter @inftkr/www build

# ---- stage 2: production ----
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# copy standalone output
COPY --from=builder /app/apps/www/.next/standalone ./
COPY --from=builder /app/apps/www/.next/static apps/www/.next/static
COPY --from=builder /app/apps/www/public apps/www/public

EXPOSE 3001

CMD ["node", "apps/www/server.js"]
