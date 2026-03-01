#!/bin/bash
# DropCrate startup script — launches bgutil PO token server + FastAPI

# Start bgutil PO token server in background (port 4416)
if [ -d /opt/bgutil/server/build ]; then
    echo "[start.sh] Starting bgutil PO token server (latest) on port 4416..."
    (cd /opt/bgutil/server && node build/main.js) &
    BGUTIL_PID=$!
    sleep 3

    if kill -0 $BGUTIL_PID 2>/dev/null; then
        echo "[start.sh] bgutil server started (PID $BGUTIL_PID)"
        # Health check
        if curl -sf http://127.0.0.1:4416/ > /dev/null 2>&1; then
            echo "[start.sh] ✅ PO Token server is responding on port 4416"
        else
            echo "[start.sh] ⚠️  PO Token server started but not yet responding (may need warmup)"
        fi
    else
        echo "[start.sh] ❌ bgutil server failed to start. YouTube downloads may require cookies."
    fi
else
    echo "[start.sh] ❌ bgutil server not found — skipping PO token provider."
fi

# Start FastAPI (exec replaces shell — becomes PID 1 for proper signal handling)
echo "[start.sh] Starting FastAPI on port ${PORT:-10000}..."
exec uvicorn dropcrate.main:app --host 0.0.0.0 --port "${PORT:-10000}"
