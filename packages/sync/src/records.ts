import { z } from "zod";

// What every synced record has, and how changes travel. An app lists its
// kinds of record with their schemas; this gives it the check for changes
// coming from the other side.
//
// Every record has an ID made on the device that created it (so it can be
// created offline), the time it last changed on a device (the newer change
// wins when two devices disagree), and a deleted flag (so deleting syncs like
// any change).

export const recordBase = {
  id: z.string().min(1).max(128),
  /** When it last changed, in milliseconds, on the device that changed it. */
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean().default(false),
};

export type BaseRecord = { id: string; updatedAt: number; deleted: boolean };

/** An app's kinds of record and their schemas, e.g. { workout: workoutSchema, set: setSchema }. */
export type Schemas = Record<string, z.ZodType<BaseRecord, unknown>>;

export type KindOf<S extends Schemas> = keyof S & string;
export type RecordOf<S extends Schemas, K extends KindOf<S>> = z.infer<S[K]>;

/** A record on the wire: which kind, and the record. */
export type Change<S extends Schemas> = { [K in KindOf<S>]: { kind: K; record: RecordOf<S, K> } }[KindOf<S>];

/** At most this many changes go in one sync request, and come back in one answer. */
export const SYNC_BATCH = 2000;

/** A new ID: random, made on this device. */
export const newId = () => crypto.randomUUID();

const wire = z.object({ kind: z.string(), record: z.record(z.string(), z.unknown()) });

/** Checks a change from the other side: null when it isn't a valid record of a known kind. */
export function changeParser<S extends Schemas>(schemas: S) {
  return (input: unknown): Change<S> | null => {
    const outer = wire.safeParse(input);
    if (!outer.success || !Object.hasOwn(schemas, outer.data.kind)) return null;
    const record = schemas[outer.data.kind]!.safeParse(outer.data.record);
    return record.success ? ({ kind: outer.data.kind, record: record.data } as Change<S>) : null;
  };
}
