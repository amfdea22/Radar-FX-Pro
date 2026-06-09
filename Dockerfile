FROM node:18-alpine AS builder

WORKDIR /app

# Dependências do servidor
COPY server/package*.json ./server/
RUN cd server && npm ci

# Código do servidor
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/
RUN cd server && npx prisma generate 2>/dev/null || true
RUN cd server && npm run build

# Dependências do cliente
COPY client/package*.json ./client/
RUN cd client && npm ci

# Código do cliente e build
COPY client/ ./client/
RUN cd client && npm run build

# ─── Imagem final ──────────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
EXPOSE 3015

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3015/api/health || exit 1

CMD ["node", "server/dist/index.js"]
