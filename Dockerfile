# Production image for Cloud Run (apt.dsoom.com).
# Built from a clean Linux checkout, so no locally installed (e.g. Windows) node_modules leak in.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
# The start script appends an intermediate CA to the system bundle at
# /etc/ssl/certs/ca-certificates.crt (needed for dynamice.busan.go.kr).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
USER node
EXPOSE 8080
CMD ["npm", "start"]
