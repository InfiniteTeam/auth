# ---- stage 1: build ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

# monorepo root
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json .npmrc ./

# shared packages
COPY packages/shared/package.json packages/shared/
COPY packages/auth-core/package.json packages/auth-core/

# backend app
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile

# prisma schema (needed for generate)
COPY apps/backend/prisma apps/backend/prisma

# source code
COPY packages/shared packages/shared/
COPY packages/auth-core packages/auth-core/
COPY apps/backend apps/backend/

RUN pnpm --filter @inftkr/shared build
RUN pnpm --filter @inftkr/auth-core build
# prisma generate must run from the backend directory (prisma.config.ts)
WORKDIR /app/apps/backend
RUN npx prisma generate
WORKDIR /app
RUN pnpm --filter @inftkr/backend build

# ---- stage 2: production ----
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

ENV NODE_ENV=production

# copy built backend
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/package.json apps/backend/
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts apps/backend/prisma.config.ts

# copy prisma client generated files
COPY --from=builder /app/apps/backend/src/generated apps/backend/src/generated

# copy shared dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/auth-core/dist packages/auth-core/dist
COPY --from=builder /app/packages/auth-core/package.json packages/auth-core/

# install production deps only
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# prisma migrate deploy + app start
COPY deploy/backend/entrypoint.sh apps/backend/entrypoint.sh
RUN chmod +x apps/backend/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["apps/backend/entrypoint.sh"]
