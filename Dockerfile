# Use Node.js 18 LTS as base image
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies (including dev dependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code and config files
COPY src/ src/
COPY tsconfig.json ./
COPY openapi.yaml ./
COPY public/ public/

# Build TypeScript
RUN yarn build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/openapi.yaml ./
COPY --from=build /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S geohash -u 1001

# Change ownership of the app directory
RUN chown -R geohash:nodejs /app
USER geohash

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"] 