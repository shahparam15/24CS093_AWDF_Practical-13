# Official Node.js 20 LTS Alpine image for minimal attack surface and small footprint
FROM node:20-alpine

# Set container working directory
WORKDIR /app

# Ensure production environment
ENV NODE_ENV=production

# Copy package manifests first to leverage Docker build cache
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Expose Express backend port
EXPOSE 5000

# Start Express server binding to 0.0.0.0
CMD ["node", "src/server.js"]
