FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV OPENAI_API_KEY=sk-UGWQCaDpgRDfaqZQiJodQQ
ENV OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
ENV OPENAI_API_BASE=https://api.manus.im/api/llm-proxy/v1
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
