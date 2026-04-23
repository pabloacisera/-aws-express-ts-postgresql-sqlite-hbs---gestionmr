FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY src ./src
COPY public ./public
COPY types ./types
RUN npm run build

FROM node:20-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma@6.19.0 generate
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
