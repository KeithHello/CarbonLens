FROM node:22-alpine AS base
WORKDIR /app

# Install all dependencies (including dev deps needed for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production runtime
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
