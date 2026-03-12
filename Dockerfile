FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./

RUN npm ci --include=dev

COPY backend/ ./

RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]