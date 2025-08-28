# Use Node.js 18 LTS
FROM node:18-slim

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security FIRST
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Copy package files first for better Docker layer caching
COPY --chown=appuser:appuser package*.json ./

# Switch to appuser for npm install to avoid permission issues
USER appuser

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files with proper ownership
COPY --chown=appuser:appuser . .

# Create necessary directories as appuser (so they have proper ownership from the start)
RUN mkdir -p /app/data/cache /app/log /app/public /app/src /app/routes

# HuggingFace Spaces uses port 7860 by default
EXPOSE 7860

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=7860

# Start command
CMD ["node", "index.js"]