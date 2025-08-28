# Use Node.js 18 LTS
FROM node:18-slim

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security (only once)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies as root (npm packages need this)
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories and set permissions in one step
RUN mkdir -p /app/data/cache /app/log /app/public /app/src /app/routes && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod -R 775 /app/data && \
    chmod -R 775 /app/log

# Switch to non-root user
USER appuser

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