# syntax=docker/dockerfile:1.7
# Dockerfile multi-stage do backend MC Pulse.
#
# Estágios:
#   1. deps       — instala dependências do workspace
#   2. builder    — gera Prisma client e compila TypeScript
#   3. runner     — imagem final enxuta com Chromium instalado para Puppeteer
#
# O build é feito a partir da raiz do monorepo para aproveitar os workspaces
# do npm. No Railway/Fly, definir Build Context = raiz do repo e Dockerfile =
# apps/api/Dockerfile.

# ─────────────────────────────────────────────
# 1. deps
# ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

WORKDIR /repo
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copia manifests do workspace + api (tira proveito do cache de layer)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Instala apenas o workspace da API (dev deps incluídas para build)
RUN npm install --workspace=apps/api --include-workspace-root --no-audit --no-fund

# ─────────────────────────────────────────────
# 2. builder
# ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /repo
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api

# Gera Prisma client e compila
RUN npx --prefix apps/api prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build --workspace=apps/api

# ─────────────────────────────────────────────
# 3. runner (produção)
# ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + fontes para PDFs + certs + tini (init limpo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    tini \
  && rm -rf /var/lib/apt/lists/*

# Usuário não-root
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs mcpulse

# Copia artefatos da build
COPY --from=builder --chown=mcpulse:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=mcpulse:nodejs /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=mcpulse:nodejs /repo/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=mcpulse:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=mcpulse:nodejs /repo/package.json ./package.json

USER mcpulse

EXPOSE 3001

# tini garante propagação correta de sinais + reap de zombies
ENTRYPOINT ["/usr/bin/tini", "--"]

# Roda migrations e sobe o servidor
CMD ["sh", "-c", "npx --prefix apps/api prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
