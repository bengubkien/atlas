"use client";

import { useEffect } from "react";

import { thisDevice } from "@/lib/local/device";

/**
 * Keeps this device in step with the server: syncs when Milo opens, when the
 * connection comes back, when you return to it, every 30 seconds while it's
 * on screen, and a moment after you change something. Also installs the
 * offline copy (public/sw.js) and asks the browser to keep Milo's data.
 */
export function Runtime() {
  useEffect(() => {
    const device = thisDevice();
    device.onChange = () => device.syncSoon();
    const sync = () => {
      if (document.visibilityState === "visible") void device.sync();
    };
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    const interval = setInterval(sync, 30_000);

    // Without this, a browser may clear a site's data when space runs low.
    void navigator.storage?.persist?.().catch(() => undefined);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_MILO_BUILD}`, { scope: "/" }).catch((error: unknown) => {
        console.warn("Milo's offline copy didn't install:", error);
      });
    }

    return () => {
      device.onChange = null;
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
      clearInterval(interval);
    };
  }, []);
  return null;
}
