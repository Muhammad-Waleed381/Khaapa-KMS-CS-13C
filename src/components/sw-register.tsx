"use client";

import { useEffect } from "react";

// Production only: a service worker caching dev bundles fights hot reload.
// Set NEXT_PUBLIC_SW_DEV=1 to test offline behaviour under `next dev`.
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW_DEV !== "1") return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW registration failed", e));
  }, []);
  return null;
}
