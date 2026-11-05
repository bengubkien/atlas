import "server-only";

import { cache } from "react";
import { z } from "zod";

import { MicasaError, read, run, write } from "./run";
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

/** The kinds of record micasa's `db` commands manage, by their command names. */
export const ENTITIES = ["maintenance", "service-log", "project", "quote", "incident", "appliance", "vendor", "document"] as const;
export type Entity = (typeof ENTITIES)[number];

/**
 * Deletes a record. micasa keeps it, marked deleted, so `restoreRecord`
 * brings it back (Hestia's Undo). micasa refuses while other records
 * depend on it ("project has 2 active quote(s) -- delete them first").
 */
export const deleteRecord = (entity: Entity, id: string) => run(["db", entity, "delete", id]);
export const restoreRecord = (entity: Entity, id: string) => run(["db", entity, "restore", id]);

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
export const editService = (id: string, input: Partial<Omit<ServiceInput, "maintenance_item_id">>) =>
  write(serviceLogSchema, ["db", "service-log", "edit", id], data(input));

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

export type QuoteInput = {
  project_id: string;
  total_cents: number;
  labor_cents?: number | null;
  materials_cents?: number | null;
  /** YYYY-MM-DD, or null for none. */
  received_date?: string | null;
  notes?: string;
  /** An existing vendor, or a new one by name (micasa creates it). One of the two is required. */
  vendor_id?: string;
  vendor_name?: string;
};

export const addQuote = (input: QuoteInput) => write(quoteSchema, ["db", "quote", "add"], data(input));
export const editQuote = (id: string, input: Partial<QuoteInput>) => write(quoteSchema, ["db", "quote", "edit", id], data(input));

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
export const editIncident = (id: string, input: Partial<IncidentInput> & { date_resolved?: string | null; cost_cents?: number | null; vendor_id?: string | null }) =>
  write(incidentSchema, ["db", "incident", "edit", id], data(input));

// --- Appliances, vendors, the house -----------------------------------------

export const listAppliances = lister("appliances");
export const getAppliance = getter("appliances", "appliance");
export const listVendors = lister("vendors");
export const getVendor = getter("vendors", "vendor");
export const listDocuments = lister("documents");
export const getHouse = lister("house");

export type ApplianceInput = {
  name: string;
  brand?: string;
  model_number?: string;
  serial_number?: string;
  location?: string;
  /** YYYY-MM-DD, or null for none. */
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  cost_cents?: number | null;
  notes?: string;
};

export const addAppliance = (input: ApplianceInput) => write(applianceSchema, ["db", "appliance", "add"], data(input));
export const editAppliance = (id: string, input: Partial<ApplianceInput>) => write(applianceSchema, ["db", "appliance", "edit", id], data(input));

export type VendorInput = { name: string; contact_name?: string; email?: string; phone?: string; website?: string; notes?: string };

export const addVendor = (input: VendorInput) => write(vendorSchema, ["db", "vendor", "add"], data(input));
export const editVendor = (id: string, input: Partial<VendorInput>) => write(vendorSchema, ["db", "vendor", "edit", id], data(input));

/** What a document can be attached to, by micasa's names for them. */
export const DOCUMENT_KINDS = ["project", "quote", "maintenance", "appliance", "service_log", "vendor", "incident"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Attaches a file to a record. micasa reads it from disk: its name becomes
 * the document's file name, and its type is worked out from its contents.
 */
export const addDocument = (input: { entity_kind: DocumentKind; entity_id: string; title?: string; notes?: string }, file: string) =>
  write(documentSchema, ["db", "document", "add"], [...data(input), "--file", file]);
export const editDocument = (id: string, input: { title?: string; notes?: string }) =>
  write(documentSchema, ["db", "document", "edit", id], data(input));

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
  lot_square_feet?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  // Systems.
  heating_type?: string;
  cooling_type?: string;
  water_source?: string;
  sewer_type?: string;
  wiring_type?: string;
  roof_type?: string;
  foundation_type?: string;
  exterior_type?: string;
  parking_type?: string;
  basement_type?: string;
  // Costs and cover.
  insurance_carrier?: string;
  insurance_policy?: string;
  /** YYYY-MM-DD, or null for none. */
  insurance_renewal?: string | null;
  property_tax_cents?: number | null;
  hoa_name?: string;
  hoa_fee_cents?: number | null;
};

/** Saves the house profile: micasa keeps one, made the first time and edited after. */
export async function saveHouse(input: HouseInput) {
  const exists = Boolean((await getHouse()).id);
  return write(houseSchema, ["db", "house", exists ? "edit" : "add"], data(input));
}
