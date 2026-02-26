"use client";

import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { useConnectionStore } from "@/stores/connection-store";

export function useConnectionMonitor() {
  const setConnected = useConnectionStore((s) => s.setConnected);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        await api.health();
        if (active) setConnected(true);
      } catch {
        if (active) setConnected(false);
      }
    }

    check();
    const id = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setConnected]);
}
