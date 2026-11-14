import type { Text } from "../model";
import texts from "./texts.json";

// The sample texts shipped with the app, so the reader works before any
// text is generated, and as the model of what a generated text looks like.
//
// texts.json is made by scripts/build-samples.mjs from the authoring form
// in ./source (how it works: ./build.ts). It is checked against the Text
// schema and the dictionary by samples.test.ts, so it's used as it is here,
// with no parsing at run time.

/**
 * Bump when the samples change, so devices that seeded an older set
 * replace it (`Device.seed`).
 */
export const SAMPLES_VERSION = 2;

/** Ten texts: three stories, three dialogues, two on culture, two news pieces. IDs "sample-<name>". */
export const SAMPLE_TEXTS: Text[] = texts as unknown as Text[];
