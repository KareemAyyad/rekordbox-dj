"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSegmentStore } from "@/stores/segment-store";
import { mapSegment } from "@/lib/api-client";

export function useSegmentSSE(jobId: string | null) {
  const addSegment = useSegmentStore((s) => s.addSegment);
  const setSegments = useSegmentStore((s) => s.setSegments);
  const setProcessing = useSegmentStore((s) => s.setProcessing);
  const setProgress = useSegmentStore((s) => s.setProgress);
  const setModelLoading = useSegmentStore((s) => s.setModelLoading);
  const setError = useSegmentStore((s) => s.setError);
  const setJobId = useSegmentStore((s) => s.setJobId);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/segment/events?job_id=${jobId}`);

    es.onmessage = (msg) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event: any = JSON.parse(msg.data);
        switch (event.type) {
          case "auto-start":
            setProcessing(true);
            setProgress({ current: 0, total: event.total, label: "Starting..." });
            break;
          case "model-loading":
            setModelLoading(true);
            setProgress({ current: 0, total: 0, label: "Loading AI model..." });
            break;
          case "model-ready":
            setModelLoading(false);
            break;
          case "segment-start":
            setProgress({ current: event.index + 1, total: event.total, label: event.label });
            break;
          case "segment-done":
            addSegment(mapSegment(event.segment));
            break;
          case "segment-error":
            toast.warning(`Failed to separate: ${event.prompt}`);
            break;
          case "auto-done":
            setSegments(event.segments.map(mapSegment));
            setProcessing(false);
            setProgress(null);
            setJobId(null);
            toast.success(`Separated into ${event.segments.length} sounds`);
            break;
          case "auto-error":
            setError(event.error);
            setProcessing(false);
            setProgress(null);
            setJobId(null);
            toast.error(event.error);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // Browser auto-reconnects
    };

    return () => es.close();
  }, [jobId, addSegment, setSegments, setProcessing, setProgress, setModelLoading, setError, setJobId]);
}
