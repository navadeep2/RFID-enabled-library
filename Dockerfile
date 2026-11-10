FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy codebase
COPY . .

# Set up permissions for Hugging Face non-root user (UID 1000)
RUN useradd -m -u 1000 user && \
    mkdir -p data backups snapshots && \
    chown -R user:user /app
USER user

# Default to 7860 (Hugging Face default) or override with $PORT
ENV PORT=7860
EXPOSE 7860
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
