import { Device } from "@atlas/sync/device";

import { SCHEMAS } from "../model";

// This browser's copy of Milo (see @atlas/sync/device). The indexes are the
// ones the screens query by.

export type MiloDevice = Device<typeof SCHEMAS>;

let device: MiloDevice | null = null;

export function thisDevice(): MiloDevice {
  device ??= new Device({ name: "milo", schemas: SCHEMAS, indexes: { workout: "startedAt", set: "workoutId, exerciseId" } });
  return device;
}
