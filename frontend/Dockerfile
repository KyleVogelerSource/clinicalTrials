FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g @angular/cli@18 && npm install

COPY . .

EXPOSE 4200

CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--proxy-config", "proxy.conf.json", "--disable-host-check", "--poll", "2000"]
