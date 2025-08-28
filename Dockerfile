# Use Node.js 18 LTS
FROM node:18-slim

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Create necessary directories with proper permissions
RUN mkdir -p /app/data/cache /app/log /app/public /app/src /app/routes && \
    chown -R appuser:appuser /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies as root (npm packages need this)
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Set proper ownership after copying files
RUN chown -R appuser:appuser /app

# Ensure log directory is writable
RUN chmod 755 /app/log

# Create data directory for file cache with proper permissions
RUN mkdir -p /app/data/cache && \
    chown -R appuser:appuser /app/data && \
    chmod -R 755 /app/data

# Switch to non-root user
USER appuser

# Expose port (HuggingFace uses 7860 by default, but your app uses 7000)
EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7000/ || exit 1

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=7000

# Start command
CMD ["node", "index.js"]