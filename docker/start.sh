#!/bin/bash
# DropCrate startup script — launches bgutil PO token server + FastAPI

# Start bgutil PO token server in background (port 4416)
if [ -d /opt/bgutil/server/build ]; then
    echo "[start.sh] Starting bgutil PO token server on port 4416..."
    (cd /opt/bgutil/server && node build/main.js) &
    BGUTIL_PID=$!
    sleep 2

    if kill -0 $BGUTIL_PID 2>/dev/null; then
        echo "[start.sh] bgutil server started (PID $BGUTIL_PID)"
    else
        echo "[start.sh] WARNING: bgutil server failed to start. YouTube downloads may require cookies."
    fi
else
    echo "[start.sh] bgutil server not found — skipping PO token provider."
fi

# Start FastAPI (exec replaces shell — becomes PID 1 for proper signal handling)
echo "[start.sh] Starting FastAPI on port ${PORT:-10000}..."
exec uvicorn dropcrate.main:app --host 0.0.0.0 --port "${PORT:-10000}"
