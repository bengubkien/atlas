import type { Measure, Measurement, Settings } from "./model";

// The measures every Hygeia starts with. Their IDs are fixed ("m-weight"),
// so they're the same on every device without syncing; editing one (its
// target range, say) saves a record with the same ID, which then wins.
//
// The ranges are common adult references, there as a guide; set your own on
// each measure. They aren't medical advice.

const builtIn = (id: string, fields: Partial<Measure> & Pick<Measure, "name" | "unit">): Measure => ({
  id,
  updatedAt: 0,
  deleted: false,
  pair: false,
  decimals: 1,
  low: null,
  high: null,
  low2: null,
  high2: null,
  pinned: true,
  notes: "",
  ...fields,
});

export const WEIGHT = "m-weight";
export const BLOOD_PRESSURE = "m-blood-pressure";
export const GLUCOSE = "m-glucose";

export const BUILT_IN_MEASURES: Measure[] = [
  builtIn(WEIGHT, { name: "Weight", unit: "kg" }),
  builtIn(BLOOD_PRESSURE, { name: "Blood pressure", unit: "mmHg", pair: true, decimals: 0, high: 120, high2: 80 }),
  builtIn("m-heart-rate", { name: "Resting heart rate", unit: "bpm", decimals: 0, low: 60, high: 100 }),
  builtIn("m-sleep", { name: "Sleep", unit: "hours", decimals: 1, low: 7, high: 9 }),
  builtIn(GLUCOSE, { name: "Blood glucose", unit: "mg/dL", decimals: 0, low: 70, high: 99, pinned: false }),
];

/** The built-ins with your edits winning, and your own measures; deleted ones left out. */
export function mergeMeasures(own: Measure[]): Measure[] {
  const byId = new Map(BUILT_IN_MEASURES.map((measure) => [measure.id, measure]));
  for (const measure of own) byId.set(measure.id, measure);
  return [...byId.values()].filter((measure) => !measure.deleted);
}

const KG_PER_LB = 0.45359237;
const MGDL_PER_MMOL = 18.0182;

/**
 * How a measure is shown with your settings: weight in kg or lb, glucose in
 * mg/dL or mmol/L; everything else as stored.
 */
export function display(measure: Measure, settings: Settings) {
  if (measure.id === WEIGHT && settings.weightUnit === "lb") {
    return { unit: "lb", decimals: 1, toShown: (kg: number) => kg / KG_PER_LB, toStored: (lb: number) => lb * KG_PER_LB };
  }
  if (measure.id === GLUCOSE && settings.glucoseUnit === "mmol/L") {
    return { unit: "mmol/L", decimals: 1, toShown: (mg: number) => mg / MGDL_PER_MMOL, toStored: (mmol: number) => mmol * MGDL_PER_MMOL };
  }
  return { unit: measure.unit, decimals: measure.decimals, toShown: (value: number) => value, toStored: (value: number) => value };
}

/** A reading as words: "72.4 kg", "118/76 mmHg". */
export function readingText(measure: Measure, reading: Pick<Measurement, "value" | "value2">, settings: Settings, locale: string): string {
  const shown = display(measure, settings);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: shown.decimals, minimumFractionDigits: 0 }).format(shown.toShown(value));
  const value = measure.pair && reading.value2 !== null ? `${number(reading.value)}/${number(reading.value2)}` : number(reading.value);
  return shown.unit ? `${value} ${shown.unit}` : value;
}

/** Where a reading stands against the measure's range; for a pair, either number out of its range counts. */
export function standing(measure: Measure, reading: Pick<Measurement, "value" | "value2">): "low" | "high" | "in" | null {
  const second = measure.pair && reading.value2 !== null;
  if ([measure.low, measure.high, ...(second ? [measure.low2, measure.high2] : [])].every((limit) => limit === null)) return null;
  const above = (value: number, high: number | null) => high !== null && value > high;
  const below = (value: number, low: number | null) => low !== null && value < low;
  if (above(reading.value, measure.high) || (second && above(reading.value2!, measure.high2))) return "high";
  if (below(reading.value, measure.low) || (second && below(reading.value2!, measure.low2))) return "low";
  return "in";
}
