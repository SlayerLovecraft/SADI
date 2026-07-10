# Etapa 1: Construcción de la app React
FROM node:18 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa 2: Servir la app con Nginx
FROM nginx:alpine

# SPA fallback (React Router) + cache headers básicos
RUN rm -f /etc/nginx/conf.d/default.conf && \
    printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '' \
    '  location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {' \
    '    try_files $uri =404;' \
    '    expires 7d;' \
    '    add_header Cache-Control "public, max-age=604800, immutable";' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

# Copiamos el build de Vite al directorio que sirve nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Exponemos el puerto
EXPOSE 80

# Arrancamos nginx
CMD ["nginx", "-g", "daemon off;"]
