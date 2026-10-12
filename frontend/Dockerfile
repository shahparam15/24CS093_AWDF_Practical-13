# ==========================================
# Stage 1: Build React Production Bundle
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests for layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and build config
COPY . .

# Build Vite React SPA into /app/dist
RUN npm run build

# ==========================================
# Stage 2: Lightweight Nginx Production Server
# ==========================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
