# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy app source
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
