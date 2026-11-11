import { Device } from "@atlas/sync/device";

import { SCHEMAS } from "../model";

// This browser's copy of Clio (see @atlas/sync/device). The indexes are the
// ones the screens query by. Raise the version when kinds or indexes change.

export type ClioDevice = Device<typeof SCHEMAS>;

let device: ClioDevice | null = null;

export function thisDevice(): ClioDevice {
  device ??= new Device({
    name: "clio",
    schemas: SCHEMAS,
    indexes: {
      text: "band, createdAt",
      // A word with no card isn't in the card.due index, so "due" reads only words in review.
      word: "status, card.due",
      review: "word, review",
      day: "date",
    },
  });
  return device;
}

const DEVICE_KEY = "clio-device";
let fallbackKey: string | null = null;

/**
 * A name for this browser, for its own `day` records (model.ts). Kept in
 * localStorage, as a per-device convenience: nothing else should sync it.
 * Where storage is blocked it lasts as long as the page.
 */
export function deviceKey(): string {
  try {
    let key = localStorage.getItem(DEVICE_KEY);
    if (!key) {
      key = crypto.randomUUID().slice(0, 8);
      localStorage.setItem(DEVICE_KEY, key);
    }
    return key;
  } catch {
    fallbackKey ??= crypto.randomUUID().slice(0, 8);
    return fallbackKey;
  }
}
