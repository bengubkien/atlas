import { z } from "zod";

// The shapes micasa's JSON commands answer with (micasa 2.8.2), for the fields
// Hestia uses. Objects are loose: fields micasa adds later pass through. The
// contract tests (micasa.test.ts) check these against the real program.

const id = z.string();
/** An RFC 3339 timestamp; micasa's dates are calendar dates, read from its first ten characters. */
const timestamp = z.string();
const cents = z.number().int().nullable();
const text = z.string().default("");
const ref = z.string().nullable();

export const PROJECT_STATUSES = ["ideating", "planned", "quoted", "underway", "delayed", "completed", "abandoned"] as const;
export const INCIDENT_STATUSES = ["open", "in_progress", "resolved"] as const;
export const INCIDENT_SEVERITIES = ["urgent", "soon", "whenever"] as const;
export const SEASONS = ["spring", "summer", "fall", "winter"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type Season = (typeof SEASONS)[number];

export const maintenanceSchema = z.looseObject({
  id,
  name: z.string(),
  category: text,
  category_id: ref,
  appliance: text,
  appliance_id: ref,
  interval_months: z.number().int().default(0),
  due_date: timestamp.nullable(),
  last_serviced_at: timestamp.nullable(),
  cost_cents: cents,
  notes: text,
  season: text,
});

export const serviceLogSchema = z.looseObject({
  id,
  maintenance_item: text,
  maintenance_item_id: z.string(),
  serviced_at: timestamp,
  cost_cents: cents,
  notes: text,
  vendor: text,
  vendor_id: ref,
});

export const projectSchema = z.looseObject({
  id,
  title: z.string(),
  description: text,
  status: z.enum(PROJECT_STATUSES),
  project_type: text,
  project_type_id: ref,
  start_date: timestamp.nullable(),
  end_date: timestamp.nullable(),
  budget_cents: cents,
  actual_cents: cents,
});

export const quoteSchema = z.looseObject({
  id,
  project: text,
  project_id: z.string(),
  vendor: text,
  vendor_id: ref,
  total_cents: z.number().int(),
  labor_cents: cents,
  materials_cents: cents,
  received_date: timestamp.nullable(),
  notes: text,
});

export const vendorSchema = z.looseObject({
  id,
  name: z.string(),
  contact_name: text,
  email: text,
  phone: text,
  website: text,
  notes: text,
});

export const applianceSchema = z.looseObject({
  id,
  name: z.string(),
  brand: text,
  model_number: text,
  serial_number: text,
  location: text,
  purchase_date: timestamp.nullable(),
  warranty_expiry: timestamp.nullable(),
  cost_cents: cents,
  notes: text,
});

export const incidentSchema = z.looseObject({
  id,
  title: z.string(),
  description: text,
  status: z.enum(INCIDENT_STATUSES),
  severity: z.enum(INCIDENT_SEVERITIES),
  location: text,
  appliance: text,
  appliance_id: ref,
  vendor: text,
  vendor_id: ref,
  date_noticed: timestamp.nullable(),
  date_resolved: timestamp.nullable(),
  cost_cents: cents,
  notes: text,
});

export const documentSchema = z.looseObject({
  id,
  title: text,
  file_name: text,
  mime_type: text,
  size_bytes: z.number().int(),
  entity_kind: text,
  entity_id: text,
  notes: text,
});

export const lookupSchema = z.looseObject({ id, name: z.string() });

/** The house profile; empty (`{}`) until it's filled in. */
export const houseSchema = z.looseObject({
  id: z.string().optional(),
  nickname: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  year_built: z.number().nullable().optional(),
  square_feet: z.number().nullable().optional(),
  lot_square_feet: z.number().nullable().optional(),
  bedrooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  foundation_type: z.string().optional(),
  wiring_type: z.string().optional(),
  roof_type: z.string().optional(),
  exterior_type: z.string().optional(),
  heating_type: z.string().optional(),
  cooling_type: z.string().optional(),
  water_source: z.string().optional(),
  sewer_type: z.string().optional(),
  parking_type: z.string().optional(),
  basement_type: z.string().optional(),
  insurance_carrier: z.string().optional(),
  insurance_policy: z.string().optional(),
  insurance_renewal: z.string().nullable().optional(),
  property_tax_cents: z.number().nullable().optional(),
  hoa_name: z.string().optional(),
  hoa_fee_cents: z.number().nullable().optional(),
});

/** `micasa status --json`: what needs attention. */
export const statusSchema = z.looseObject({
  overdue: z
    .array(
      z.looseObject({ id, name: z.string(), category: text, appliance: text, next_due: z.string(), days_overdue: z.number() }),
    )
    .nullable()
    .transform((list) => list ?? []),
  upcoming: z
    .array(
      z.looseObject({ id, name: z.string(), category: text, appliance: text, next_due: z.string(), days_until_due: z.number() }),
    )
    .nullable()
    .transform((list) => list ?? []),
  incidents: z
    .array(
      z.looseObject({
        id,
        title: z.string(),
        status: z.enum(INCIDENT_STATUSES),
        severity: z.enum(INCIDENT_SEVERITIES),
        date_noticed: z.string(),
      }),
    )
    .nullable()
    .transform((list) => list ?? []),
  active_projects: z
    .array(z.looseObject({ id, title: z.string(), status: z.enum(PROJECT_STATUSES), start_date: z.string().nullable().optional() }))
    .nullable()
    .transform((list) => list ?? []),
});

export const settingsSchema = z.array(z.looseObject({ key: z.string(), value: z.string() }));
export const documentDataSchema = z.array(z.looseObject({ hex: z.string() }));

export type MaintenanceItem = z.infer<typeof maintenanceSchema>;
export type ServiceLogEntry = z.infer<typeof serviceLogSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Vendor = z.infer<typeof vendorSchema>;
export type Appliance = z.infer<typeof applianceSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type HouseDocument = z.infer<typeof documentSchema>;
export type Lookup = z.infer<typeof lookupSchema>;
export type House = z.infer<typeof houseSchema>;
export type Status = z.infer<typeof statusSchema>;
