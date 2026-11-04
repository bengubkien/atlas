import { Device } from "@atlas/sync/device";

import { SCHEMAS } from "../model";

// This browser's copy of Hygeia (see @atlas/sync/device). The indexes are
// the ones the screens query by.

export type HygeiaDevice = Device<typeof SCHEMAS>;

let device: HygeiaDevice | null = null;

export function thisDevice(): HygeiaDevice {
  device ??= new Device({
    name: "hygeia",
    schemas: SCHEMAS,
    indexes: { measurement: "measureId, at", dose: "date, medicationId", journal: "date", appointment: "at", labReport: "date", labResult: "reportId" },
  });
  return device;
}
