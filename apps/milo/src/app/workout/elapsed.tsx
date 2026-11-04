"use client";

import { useEffect, useState } from "react";

import { clock } from "@/lib/units";

/** Time since a moment, ticking every second: "23:41". */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="font-mono tabular-nums">{clock((now - since) / 1000)}</span>;
}
