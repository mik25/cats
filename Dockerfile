FROM debian:12.5-slim

EXPOSE 80
WORKDIR /home

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js the Lampac way
RUN curl -fSL -o node.tar.gz https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.gz \
    && mkdir -p /usr/local/nodejs \
    && tar -xzf node.tar.gz -C /usr/local/nodejs --strip-components=1 \
    && rm node.tar.gz \
    && ln -s /usr/local/nodejs/bin/node /usr/local/bin/node \
    && ln -s /usr/local/nodejs/bin/npm /usr/local/bin/npm

# Download your actual app from GitHub and patch the port
RUN curl -L -o cats.zip https://github.com/mik25/cats/archive/refs/heads/main.zip \
    && apt-get update && apt-get install -y unzip && apt-get clean \
    && unzip cats.zip && rm cats.zip \
    && mv cats-main/* . && rm -rf cats-main

# Force replace any hardcoded 7860 references with 80
RUN find . -type f -name "*.js" -exec sed -i 's/7860/80/g' {} \; || true
RUN find . -type f -name "*.json" -exec sed -i 's/7860/80/g' {} \; || true

# Install your app's dependencies
RUN npm install

# Create necessary directories with permissions (from your original Dockerfile)
RUN mkdir -p data/cache log public src routes && chmod -R 777 data log

# Set all required environment variables (BASE_URL will auto-detect)
ENV NODE_ENV=production

ENV BASE_URL=https://efyuirkv.deploy.cx
ENV TMDB_API_KEY=6f5528da1d383de1b85c80756d82372e
ENV TRAKT_CLIENT_ID=ed6fcc39f1f1e693a9782f198d7aa595435a795cbe1944921ef39cd4b6a2339d
ENV TRAKT_CLIENT_SECRET=1df7e774a30dd5c23495e8480be0762281a1c2509fa895677c793cf8a0b1a3b5
ENV TRAKT_HISTORY_FETCH_INTERVAL=1d
ENV CACHE_CATALOG_CONTENT_DURATION_DAYS=1
ENV CACHE_POSTER_CONTENT_DURATION_DAYS=7
ENV LOG_LEVEL=debug
ENV LOG_INTERVAL_DELETION=3d
ENV DEBUG=*

# Start your actual app
CMD ["node", "index.js"]
