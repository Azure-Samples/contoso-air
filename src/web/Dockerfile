ARG NODE_VERSION=22
ARG APP_PORT=3000

# Stage 1: dependencies (install with npm, no Bun)
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
ENV NODE_ENV=development
# Leverage layer caching: only copy manifests first
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: build
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# System deps occasionally needed for native modules (uncomment if required)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     g++ make python3 ca-certificates openssl \
#  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure a clean build directory
RUN rm -rf .next && \
    npm run build

FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=${APP_PORT} \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Add non-root user
RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Create nextjs cache dir and give ownership to non-root user
RUN mkdir -p /app/.next/cache && chown -R nextjs:nextjs /app/.next

# (Optional) Install dumb-init for better signal handling (uncomment lines)
# RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
# ENTRYPOINT ["dumb-init", "--"]

# Copy minimal standalone server + static assets produced by Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# If you use next/image with sharp, Node 22 includes required libs; for custom native deps add them here.

EXPOSE ${APP_PORT}
USER nextjs

# Basic healthcheck hitting the root path (adjust if you expose a /healthz endpoint)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
#   CMD node -e "fetch('http://localhost:' + process.env.PORT).then(r=>{if(r.status>399)process.exit(1)}).catch(()=>process.exit(1))"

# Generated standalone output provides server.js entrypoint
CMD ["node", "server.js"]

###############################
# Usage:
#   docker build -t contoso-air .
#   docker run -p 3000:3000 contoso-air
# For multi-arch:
#   docker buildx build --platform=linux/amd64,linux/arm64 -t yourrepo/contoso-air:latest --push .
###############################