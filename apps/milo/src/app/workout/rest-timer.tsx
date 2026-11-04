"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { clock } from "@/lib/units";

// The rest between sets. Kept in this browser's storage, so it survives
// switching apps or reloading; when it's over, the phone buzzes and beeps.

type Rest = { endsAt: number; total: number };
const KEY = "milo-rest";
const listeners = new Set<() => void>();
let audio: AudioContext | null = null;

function read(): Rest | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Rest) : null;
  } catch {
    return null;
  }
}

let snapshot: string | null = null;
function write(rest: Rest | null) {
  try {
    if (rest) localStorage.setItem(KEY, JSON.stringify(rest));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the timer just won't survive a reload.
  }
  snapshot = rest ? JSON.stringify(rest) : null;
  listeners.forEach((listener) => listener());
}

/** Starts the rest timer. Called from a tap, which also lets the beep play later. */
export function startRest(seconds: number) {
  if (seconds <= 0) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
  write({ endsAt: Date.now() + seconds * 1000, total: seconds });
}

export function stopRest() {
  write(null);
}

function beep() {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.4);
}

function useRest(): Rest | null {
  const json = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (snapshot ??= JSON.stringify(read())),
    () => "null",
  );
  return JSON.parse(json) as Rest | null;
}

/** The bar at the bottom while resting: time left, a bit more or less, skip. */
export function RestBar() {
  const rest = useRest();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    if (!rest) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [rest]);

  const left = rest ? Math.max(0, (rest.endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    navigator.vibrate?.([200, 100, 200]);
    beep();
    const done = setTimeout(() => write(null), 4000);
    return () => clearTimeout(done);
  }, [rest, left]);

  if (!rest) return null;
  const over = left <= 0;
  const adjust = (seconds: number) =>
    write({ endsAt: Math.max(Date.now() + 1000, rest.endsAt + seconds * 1000), total: Math.max(1, rest.total + seconds) });

  return (
    <div
      role="timer"
      aria-label="Rest"
      className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-card bg-inverse text-on-inverse shadow-toast lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[360px]"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 text-sm">
          {over ? (
            <span className="font-medium">Rest over: next set</span>
          ) : (
            <>
              Rest <span className="ml-1 font-mono text-lg tabular-nums">{clock(left)}</span>
            </>
          )}
        </span>
        {!over && (
          <>
            <button type="button" onClick={() => adjust(-15)} aria-label="15 seconds less" className="grid size-10 place-items-center rounded-control hover:bg-white/10">
              <Minus size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => adjust(15)} aria-label="15 seconds more" className="grid size-10 place-items-center rounded-control hover:bg-white/10">
              <Plus size={18} aria-hidden="true" />
            </button>
          </>
        )}
        <button type="button" onClick={stopRest} aria-label={over ? "Close" : "Skip the rest"} className="grid size-10 place-items-center rounded-control hover:bg-white/10">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div aria-hidden="true" className="h-1 bg-white/15">
        <div className="h-full bg-[var(--color-accent-milo)] motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${over ? 100 : 100 - (left / rest.total) * 100}%` }} />
      </div>
    </div>
  );
}
