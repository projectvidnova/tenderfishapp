FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --ignore-scripts

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN npx turbo build --filter=@tenderfish/api

# Production
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S tenderfish -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./

USER tenderfish
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
