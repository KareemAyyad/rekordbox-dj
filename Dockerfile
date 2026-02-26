FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 git && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY packages/runpod-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy handler
COPY packages/runpod-worker/handler.py .

# RunPod serverless expects this
CMD ["python", "-u", "handler.py"]
