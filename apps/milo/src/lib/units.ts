import type { Distance, Unit } from "./model";

// Weights are stored in kilograms and shown in your unit, and distances in
// metres, shown in kilometres or miles. A value typed in and read back shows
// the same number again, to two decimals.

export const KG_PER_LB = 0.45359237;

/** Kilograms in your unit, unrounded. */
export const fromKg = (kg: number, unit: Unit) => (unit === "kg" ? kg : kg / KG_PER_LB);

/** Your unit in kilograms. */
export const toKg = (value: number, unit: Unit) => (unit === "kg" ? value : value * KG_PER_LB);

/** "62.5", "135": a weight in your unit, without trailing zeros. */
export function weightNumber(kg: number, unit: Unit): string {
  return String(Math.round(fromKg(kg, unit) * 100) / 100);
}

/** "62.5 kg", "135 lb". */
export const weightText = (kg: number, unit: Unit) => `${weightNumber(kg, unit)} ${unit}`;

export const METERS_PER_MILE = 1609.344;

/** "5", "3.11": metres in kilometres or miles, to two decimals, without trailing zeros. */
export const distanceNumber = (meters: number, distance: Distance) => String(Number((meters / (distance === "km" ? 1000 : METERS_PER_MILE)).toFixed(2)));

/** Kilometres or miles in metres, to the metre. */
export const toMeters = (value: number, distance: Distance) => Math.round(value * (distance === "km" ? 1000 : METERS_PER_MILE));

/** A number typed on a phone: "62,5" and "62.5" both work; null for empty, NaN for nonsense. */
export function parseNumber(input: string): number | null {
  const text = input.trim().replace(",", ".");
  if (!text) return null;
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

/** "1:05", "12:30", "1:02:03" for seconds. */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Seconds from "1:30", "90" or "1:02:03"; null for empty, NaN for nonsense. */
export function parseClock(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return Number.NaN;
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}
