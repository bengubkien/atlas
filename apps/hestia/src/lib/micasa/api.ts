import "server-only";

import { cache } from "react";
import { z } from "zod";

import { MicasaError, read, write } from "./run";
import {
  applianceSchema,
  documentDataSchema,
  documentSchema,
  houseSchema,
  incidentSchema,
  lookupSchema,
  maintenanceSchema,
  projectSchema,
  quoteSchema,
  serviceLogSchema,
  settingsSchema,
  statusSchema,
  vendorSchema,
  type IncidentSeverity,
  type IncidentStatus,
  type ProjectStatus,
} from "./schemas";

// The commands Hestia uses, typed. Everything is read in one command,
// `micasa show all --json` (the same records as each `micasa db <entity>
// list`, which the contract tests check), once per request thanks to React's
// cache(). Writes go through `micasa db <entity> add|edit`.

// An empty section is left out of `show all`, or null: both read as nothing there.
const rows = <S extends z.ZodType>(schema: S) => z.array(schema).nullish().transform((list) => list ?? []);

const everythingSchema = z.looseObject({
  maintenance: rows(maintenanceSchema),
  maintenance_categories: rows(lookupSchema),
  service_log: rows(serviceLogSchema),
  projects: rows(projectSchema),
  project_types: rows(lookupSchema),
  quotes: rows(quoteSchema),
  incidents: rows(incidentSchema),
  appliances: rows(applianceSchema),
  vendors: rows(vendorSchema),
  documents: rows(documentSchema),
  house: houseSchema.nullish().transform((house) => house ?? {}),
});

export type Everything = z.infer<typeof everythingSchema>;

/** Every record in the house, read once per request. `show all` is the one `show` command micasa keeps. */
export const getEverything = cache(() => read(everythingSchema, ["show", "all"], ["--json"]));

const lister =
  <K extends keyof Everything>(key: K) =>
  async (): Promise<Everything[K]> =>
    (await getEverything())[key];

const getter =
  <K extends "maintenance" | "projects" | "incidents" | "appliances" | "vendors">(key: K, what: string) =>
  async (id: string): Promise<Everything[K][number]> => {
    const found = (await getEverything())[key].find((record) => record.id === id);
    if (!found) throw new MicasaError(`get ${what}: record not found`, [id]);
    return found as Everything[K][number];
  };

const data = (input: object) => ["--data", JSON.stringify(input)];

/** Whether micasa said the record isn't there. */
export function isNotFound(error: unknown): boolean {
  return error instanceof MicasaError && /record not found/i.test(error.message);
}

// --- What needs attention ---------------------------------------------------

// `status` exits with 2 when something needs attention, as a signal for scripts.
export const getStatus = cache((days = 30) =>
  read(statusSchema, ["status"], ["--json", "--days", String(days)], { okCodes: [2] }),
);

// --- Maintenance ------------------------------------------------------------

export const listMaintenance = lister("maintenance");
export const getMaintenance = getter("maintenance", "maintenance item");
export const listCategories = lister("maintenance_categories");
export const listServiceLog = lister("service_log");

export type MaintenanceInput = {
  name: string;
  category_id: string;
  interval_months?: number;
  /** YYYY-MM-DD: a one-off due date, instead of every N months. */
  due_date?: string | null;
  appliance_id?: string | null;
  season?: string;
  cost_cents?: number | null;
  notes?: string;
};

export const addMaintenance = (input: MaintenanceInput) => write(maintenanceSchema, ["db", "maintenance", "add"], data(input));
export const editMaintenance = (id: string, input: Partial<MaintenanceInput>) =>
  write(maintenanceSchema, ["db", "maintenance", "edit", id], data(input));

export type ServiceInput = {
  maintenance_item_id: string;
  /** YYYY-MM-DD. */
  serviced_at: string;
  cost_cents?: number | null;
  notes?: string;
  /** An existing vendor, or a new one by name (micasa creates it). */
  vendor_id?: string;
  vendor_name?: string;
};

/** Records a service; micasa moves the item's "last serviced" date with it. */
export const logService = (input: ServiceInput) => write(serviceLogSchema, ["db", "service-log", "add"], data(input));

// --- Projects and quotes ----------------------------------------------------

export const listProjects = lister("projects");
export const getProject = getter("projects", "project");
export const listProjectTypes = lister("project_types");
export const listQuotes = lister("quotes");

export type ProjectInput = {
  title: string;
  project_type_id: string;
  status?: ProjectStatus;
  description?: string;
  budget_cents?: number | null;
  start_date?: string | null;
};

export const addProject = (input: ProjectInput) => write(projectSchema, ["db", "project", "add"], data(input));
export const editProject = (id: string, input: Partial<ProjectInput> & { actual_cents?: number | null; end_date?: string | null }) =>
  write(projectSchema, ["db", "project", "edit", id], data(input));

// --- Incidents --------------------------------------------------------------

export const listIncidents = lister("incidents");
export const getIncident = getter("incidents", "incident");

export type IncidentInput = {
  title: string;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  description?: string;
  location?: string;
  date_noticed?: string;
  appliance_id?: string | null;
};

export const addIncident = (input: IncidentInput) => write(incidentSchema, ["db", "incident", "add"], data(input));
export const editIncident = (id: string, input: Partial<IncidentInput> & { date_resolved?: string | null; cost_cents?: number | null }) =>
  write(incidentSchema, ["db", "incident", "edit", id], data(input));

// --- Appliances, vendors, the house -----------------------------------------

export const listAppliances = lister("appliances");
export const getAppliance = getter("appliances", "appliance");
export const listVendors = lister("vendors");
export const getVendor = getter("vendors", "vendor");
export const listDocuments = lister("documents");
export const getHouse = lister("house");

// --- Settings and files -----------------------------------------------------

/** The currency micasa formats amounts in (ISO 4217), saved in its database on first run. */
export const getCurrency = cache(async () => {
  const rows = await read(settingsSchema, ["query", "select key, value from settings where key = 'locale.currency'"], ["--json"]);
  return rows[0]?.value || "USD";
});

/** A document's file. Through micasa's read-only SQL, which is how it can be read back. */
export async function getDocumentData(id: string): Promise<Buffer> {
  // micasa's IDs are ULIDs; anything else never reaches the SQL.
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) throw new MicasaError("record not found", [id]);
  const rows = await read(documentDataSchema, ["query", `select hex(data) as hex from documents where id = '${id}'`], ["--json"]);
  if (!rows[0]) throw new MicasaError("record not found", [id]);
  return Buffer.from(rows[0].hex, "hex");
}

// --- The house profile ------------------------------------------------------

export type HouseInput = {
  nickname?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  year_built?: number | null;
  square_feet?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

/** Saves the house profile: micasa keeps one, made the first time and edited after. */
export async function saveHouse(input: HouseInput) {
  const exists = Boolean((await getHouse()).id);
  return write(houseSchema, ["db", "house", exists ? "edit" : "add"], data(input));
}
