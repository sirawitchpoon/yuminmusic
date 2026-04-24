################################
# Stage 1 — build (deps + compile TS)
################################
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

################################
# Stage 2 — runtime (slim + ffmpeg)
################################
FROM node:20-alpine AS runtime

RUN apk add --no-cache ffmpeg dumb-init python3 py3-pip

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY assets ./assets

RUN chown -R node:node /app
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
