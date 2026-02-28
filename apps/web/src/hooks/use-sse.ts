"use client";

import { useEffect } from "react";
import { useQueueStore } from "@/stores/queue-store";
import type { SSEEvent } from "@/lib/types";

export function useSSE(jobId: string | null) {
  const updateItemStatus = useQueueStore((s) => s.updateItemStatus);
  const updateItemStage = useQueueStore((s) => s.updateItemStage);
  const setRunning = useQueueStore((s) => s.setRunning);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/queue/events?job_id=${jobId}`);
    console.log("[SSE] Connecting to /api/queue/events?job_id=" + jobId);

    es.onmessage = (msg) => {
      try {
        const event: SSEEvent = JSON.parse(msg.data);
        console.log("[SSE] Event received:", event);
        switch (event.type) {
          case "queue-start":
            setRunning(true);
            break;
          case "item-start":
            updateItemStatus(event.item_id, "running");
            break;
          case "item-progress":
            updateItemStage(event.item_id, event.stage);
            break;
          case "item-done":
            updateItemStatus(event.item_id, "done");
            break;
          case "item-error":
            updateItemStatus(event.item_id, "error", event.error);
            break;
          case "queue-done":
            setRunning(false);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      // Browser auto-reconnects
    };

    return () => es.close();
  }, [jobId, updateItemStatus, updateItemStage, setRunning]);
}
