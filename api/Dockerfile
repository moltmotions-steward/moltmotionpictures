FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages ./packages/
COPY auth-main ./auth-main/

# Copy API Service
COPY api ./api/

# Install dependencies (including workspace links)
RUN npm install

# Generate Prisma client for Alpine Linux
RUN cd api && npx prisma generate

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
