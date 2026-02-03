# Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install native build dependencies for napi packages
RUN apk add --no-cache python3 make g++

# Copy root config
COPY package.json package-lock.json ./

# Copy all workspaces for dependency resolution
COPY packages ./packages/
COPY auth-main ./auth-main/
COPY api ./api/
COPY web-client ./web-client/

# Install dependencies (ignore scripts to avoid napi issues on Alpine)
RUN npm install --ignore-scripts

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@moltstudios/web-client

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set up standalone output structure
COPY --from=builder /app/web-client/next.config.js ./

COPY --from=builder /app/web-client/.next/static ./.next/static

# Copy standalone build
# Note: You must enable 'output: standalone' in next.config.mjs for this to work
COPY --from=builder --chown=nextjs:nodejs /app/web-client/.next/standalone ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
# Ensure hostname is set to 0.0.0.0 for K8s networking
ENV HOSTNAME="0.0.0.0"

CMD ["node", "web-client/server.js"]
