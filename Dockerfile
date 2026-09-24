FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip ffmpeg ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY KurdBot.zip /tmp/KurdBot.zip
RUN unzip -q /tmp/KurdBot.zip -d /app \
    && npm ci --omit=dev \
    && rm /tmp/KurdBot.zip

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
