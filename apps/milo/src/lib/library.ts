import type { Equipment, Exercise, Muscle, Tracking } from "./model";

// The exercises every Milo starts with. Their IDs are fixed ("b-bench-press"),
// so they're the same on every device without syncing; editing one saves a
// record with the same ID, which then wins over the built-in.

type Entry = [name: string, muscle: Muscle, equipment: Equipment, tracking?: Tracking];

const ENTRIES: Entry[] = [
  // Chest
  ["Bench press", "chest", "barbell"],
  ["Incline bench press", "chest", "barbell"],
  ["Dumbbell bench press", "chest", "dumbbell"],
  ["Incline dumbbell press", "chest", "dumbbell"],
  ["Cable fly", "chest", "cable"],
  ["Push-up", "chest", "bodyweight", "bodyweight"],
  // Back
  ["Deadlift", "back", "barbell"],
  ["Barbell row", "back", "barbell"],
  ["Dumbbell row", "back", "dumbbell"],
  ["Pull-up", "back", "bodyweight", "bodyweight"],
  ["Chin-up", "back", "bodyweight", "bodyweight"],
  ["Lat pulldown", "back", "cable"],
  ["Seated cable row", "back", "cable"],
  // Shoulders
  ["Overhead press", "shoulders", "barbell"],
  ["Dumbbell shoulder press", "shoulders", "dumbbell"],
  ["Lateral raise", "shoulders", "dumbbell"],
  ["Rear delt fly", "shoulders", "dumbbell"],
  ["Face pull", "shoulders", "cable"],
  // Arms
  ["Barbell curl", "biceps", "barbell"],
  ["Dumbbell curl", "biceps", "dumbbell"],
  ["Hammer curl", "biceps", "dumbbell"],
  ["Cable curl", "biceps", "cable"],
  ["Triceps pushdown", "triceps", "cable"],
  ["Skull crusher", "triceps", "barbell"],
  ["Overhead triceps extension", "triceps", "dumbbell"],
  ["Close-grip bench press", "triceps", "barbell"],
  ["Dip", "triceps", "bodyweight", "bodyweight"],
  ["Wrist curl", "forearms", "dumbbell"],
  // Legs
  ["Squat", "quads", "barbell"],
  ["Front squat", "quads", "barbell"],
  ["Leg press", "quads", "machine"],
  ["Goblet squat", "quads", "kettlebell"],
  ["Bulgarian split squat", "quads", "dumbbell"],
  ["Walking lunge", "quads", "dumbbell"],
  ["Leg extension", "quads", "machine"],
  ["Romanian deadlift", "hamstrings", "barbell"],
  ["Lying leg curl", "hamstrings", "machine"],
  ["Hip thrust", "glutes", "barbell"],
  ["Standing calf raise", "calves", "machine"],
  ["Seated calf raise", "calves", "machine"],
  // Core
  ["Plank", "core", "bodyweight", "duration"],
  ["Hanging leg raise", "core", "bodyweight", "bodyweight"],
  ["Cable crunch", "core", "cable"],
  ["Ab wheel rollout", "core", "bodyweight", "bodyweight"],
  // Whole body
  ["Kettlebell swing", "full_body", "kettlebell"],
  ["Farmer's carry", "full_body", "dumbbell", "duration"],
  // Cardio
  ["Running", "cardio", "other", "cardio"],
  ["Rowing machine", "cardio", "machine", "cardio"],
  ["Cycling", "cardio", "other", "cardio"],
];

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const BUILT_IN_EXERCISES: Exercise[] = ENTRIES.map(([name, muscle, equipment, tracking = "load"]) => ({
  id: `b-${slug(name)}`,
  updatedAt: 0,
  deleted: false,
  name,
  muscle,
  equipment,
  tracking,
  notes: "",
}));

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  full_body: "Whole body",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  band: "Band",
  other: "Other",
};

export const TRACKING_LABELS: Record<Tracking, string> = {
  load: "Weight and reps",
  bodyweight: "Reps, and any added weight",
  duration: "Time",
  cardio: "Distance and time",
};

/** The built-ins, with your own exercises added and your edits winning; deleted ones left out; by name. */
export function mergeExercises(own: Exercise[]): Exercise[] {
  const byId = new Map(BUILT_IN_EXERCISES.map((exercise) => [exercise.id, exercise]));
  for (const exercise of own) byId.set(exercise.id, exercise);
  return [...byId.values()].filter((exercise) => !exercise.deleted).sort((a, b) => a.name.localeCompare(b.name));
}
