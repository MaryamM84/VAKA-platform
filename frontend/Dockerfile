FROM docker.kernel.ir/library/node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --registry=https://registry.npmmirror.com --fetch-retries=5 --fetch-timeout=120000

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]