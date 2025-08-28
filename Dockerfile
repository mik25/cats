# Use Node.js 18 LTS
FROM node:18-slim

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Set working directory and change ownership to appuser
WORKDIR /app
RUN chown appuser:appuser /app

# Switch to appuser for all subsequent operations
USER appuser

# Copy package files first for better Docker layer caching
COPY --chown=appuser:appuser package*.json ./

# Install dependencies as appuser
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7860/ || exit 1

# Start command
CMD ["node", "index.js"]