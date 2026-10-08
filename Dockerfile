FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run check && node --input-type=module -e "import Database from 'better-sqlite3'; const db = new Database(':memory:'); db.prepare('SELECT 1').get(); db.close();"
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "scripts/bootstrap.mjs"]
