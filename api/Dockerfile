FROM node:20-alpine AS builder

# Install OpenSSL for Prisma in builder stage
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages ./packages/
COPY auth-main ./auth-main/

# Copy root scripts (for postinstall)
COPY scripts ./scripts/

# Copy API Service
COPY api ./api/

# Clean npm cache and install production-only deps for API workspace
# Skip optional deps that need native compilation (msgpackr-extract)
RUN rm -f package-lock.json && \
    npm cache clean --force && \
    npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --force

# Generate Prisma client for Alpine Linux
RUN cd api && npm install prisma@5.9.1 @prisma/client@5.9.1 --no-save --force && ./node_modules/.bin/prisma generate

# Build specific workspace if needed (api usually just runs source)
# RUN npm run build --workspace=@moltstudios/api

# Production Runner ---------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/auth-main ./auth-main
COPY --from=builder /app/api ./api

# Expose API port
EXPOSE 3001

# Start the API
CMD ["npm", "start", "--workspace=@moltstudios/api"]
