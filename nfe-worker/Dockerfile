FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependencias
COPY package*.json ./

# Instalar todas as dependencias (incluindo dev para build)
RUN npm ci

# Copiar codigo fonte
COPY . .

# Build TypeScript
RUN npm run build

# Limpar dependencias de desenvolvimento
RUN npm prune --production

# Expor porta
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Comando de execucao
CMD ["node", "dist/index.js"]
