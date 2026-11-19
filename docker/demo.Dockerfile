FROM node:24.12.0-bookworm-slim AS build
ARG APP
ARG NEXT_PUBLIC_REQUIRE_HARDWARE_BINDING=false
ENV NEXT_PUBLIC_REQUIRE_HARDWARE_BINDING=$NEXT_PUBLIC_REQUIRE_HARDWARE_BINDING
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY apps/${APP}/package*.json ./
RUN npm ci
COPY apps/${APP}/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24.12.0-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/ /app/
RUN chown node:node /app
USER node
