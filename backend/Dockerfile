FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY shared /app/shared

WORKDIR /app/backend

ENV PORT=8000
ENV MAP_DADDY_MEDIA_DIR=/data/media
ENV MAP_DADDY_PROJECTS_DIR=/data/projects

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
