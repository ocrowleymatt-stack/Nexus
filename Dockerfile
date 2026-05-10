FROM node:20-alpine
WORKDIR /app

# Install dependencies (including devDeps needed for the build step)
COPY package*.json ./
RUN npm install

# Copy source and build the frontend
COPY . .
RUN npm run build

# Runtime environment
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use npm start so the script is defined in package.json and easy to override
CMD ["npm", "start"]
