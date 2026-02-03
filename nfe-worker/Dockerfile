FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar codigo fonte
COPY . .

# Build
RUN npm run build

# Expor porta
EXPOSE 8080

# Comando de execucao
CMD ["npm", "start"]
