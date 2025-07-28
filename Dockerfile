# Use Node.js LTS version for stability
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files for dependency installation
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
CMD ["dumb-init", "npm", "run", "dev"]

# Production dependencies stage
FROM base AS dependencies
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nextjs:nodejs . .

# Switch to non-root user
USER nextjs

# Expose the port
EXPOSE 3000

# Set environment variable
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
               const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/api', method: 'GET' }; \
               const req = http.request(options, (res) => { \
                 if (res.statusCode === 200) process.exit(0); else process.exit(1); \
               }); \
               req.on('error', () => process.exit(1)); \
               req.end();"

# Start the application
CMD ["dumb-init", "npm", "start"] 