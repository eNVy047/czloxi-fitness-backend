# -------- Stage 1: Build --------
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript -> dist
RUN npm run build


# -------- Stage 2: Production --------
FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Optional: copy .env if needed at build time (usually not recommended)
# COPY .env ./

EXPOSE 3000

CMD ["node", "dist/server.js"]