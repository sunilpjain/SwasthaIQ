# Build from the repo root:  docker build -f api/Dockerfile -t swasthyaiq-api .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
RUN pnpm install --frozen-lockfile --filter api... --ignore-scripts
COPY shared shared
COPY api api
RUN pnpm --filter @swasthyaiq/shared build && pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out

FROM node:22-alpine
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production APP_ENV=dev PORT=3000
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
