# ---------- Base Image ----------
FROM node:22-alpine AS base
WORKDIR /app


# ---------- Install Dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm install


# ---------- Build Stage ----------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# generate prisma client
RUN npx prisma generate

# compile typescript
RUN npm run build


# ---------- Production Image ----------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# copy node_modules (already generated prisma client)
COPY --from=builder /app/node_modules ./node_modules

# copy compiled code
COPY --from=builder /app/dist ./dist

# copy prisma schema (needed for db push/seed)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.seed.json ./tsconfig.seed.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000

CMD ["node", "dist/server.js"]