FROM python:3.11-slim

WORKDIR /app

COPY eolis-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY eolis-api/ .

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
