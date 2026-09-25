FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY KurdBot.zip /tmp/VEXSecurity.zip
RUN python3 -m zipfile -e /tmp/VEXSecurity.zip /app && rm /tmp/VEXSecurity.zip && npm ci --omit=dev
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "src/index.js"]
