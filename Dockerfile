# Single-container deploy: React build is served by Django (WhiteNoise).
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist ./frontend_dist
ENV DJANGO_DEBUG=0 PORT=8000
CMD gunicorn config.wsgi --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 90
