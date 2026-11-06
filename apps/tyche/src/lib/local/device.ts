import { Device } from "@atlas/sync/device";

import { SCHEMAS } from "../model";

// This browser's copy of Tyche (see @atlas/sync/device). The indexes are the
// ones the screens query by.

export type TycheDevice = Device<typeof SCHEMAS>;

let device: TycheDevice | null = null;

export function thisDevice(): TycheDevice {
  device ??= new Device({
    name: "tyche",
    schemas: SCHEMAS,
    indexes: { transaction: "date, accountId, recurringId, goalId", rate: "date" },
  });
  return device;
}
