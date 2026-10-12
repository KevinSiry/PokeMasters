# Image unique de PokeFlex : site Next.js, serveur temps réel et outils (migrations, seed, import du catalogue).
# Construite et lancée par docker compose (voir docker-compose.yml).
# Image Debian complète : OpenSSL est déjà présent, ce que Prisma exige.
FROM node:22-bookworm AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Dépendances d'abord, pour profiter du cache tant que les package.json ne changent pas.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/realtime/package.json apps/realtime/
COPY packages/db/package.json packages/db/
COPY packages/game/package.json packages/game/
COPY packages/server/package.json packages/server/
COPY packages/tcgdex/package.json packages/tcgdex/
COPY config/package.json config/
COPY packages/db/prisma/schema.prisma packages/db/prisma/
RUN npm ci --no-audit --no-fund

FROM deps AS app
COPY . .
# Adresse du serveur temps réel vue par le navigateur, figée dans le build du site.
ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:3001
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL
RUN npm run db:generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000 3001
CMD ["npm", "run", "start", "-w", "@pokeflex/web"]
