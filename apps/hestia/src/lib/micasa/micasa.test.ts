import { copyFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, inject, it } from "vitest";

import { calendarDate, nextDue } from "@/lib/dates";

import { z } from "zod";

import * as micasa from "./api";
import { MicasaError, read, resetForTests } from "./run";
import { applianceSchema, incidentSchema, maintenanceSchema, projectSchema, quoteSchema, serviceLogSchema, vendorSchema } from "./schemas";

// Hestia's contract with micasa: the real program, on its own sample house.
// If an update to micasa changes what these commands answer, this fails
// before Hestia does.

const demoDb = inject("demoDb");

/** A fresh copy of the sample house for each test, so writes don't leak. */
function useCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "hestia-"));
  const db = path.join(dir, "house.db");
  copyFileSync(demoDb!, db);
  process.env.MICASA_DB_PATH = db;
  resetForTests();
  return db;
}

describe.skipIf(!demoDb)("micasa contract", () => {
  beforeEach(() => {
    useCopy();
  });

  it("reads every list Hestia shows", async () => {
    const [maintenance, log, projects, quotes, vendors, appliances, incidents, documents, categories, types] =
      await Promise.all([
        micasa.listMaintenance(),
        micasa.listServiceLog(),
        micasa.listProjects(),
        micasa.listQuotes(),
        micasa.listVendors(),
        micasa.listAppliances(),
        micasa.listIncidents(),
        micasa.listDocuments(),
        micasa.listCategories(),
        micasa.listProjectTypes(),
      ]);
    for (const list of [maintenance, log, projects, quotes, vendors, appliances, incidents, documents, categories, types]) {
      expect(list.length).toBeGreaterThan(0);
    }
    expect((await micasa.getHouse()).nickname).toBeTruthy();
  });

  it("reads in one command exactly what each `micasa db <entity> list` answers", async () => {
    const everything = await micasa.getEverything();
    const pairs = [
      ["maintenance", "maintenance", maintenanceSchema],
      ["service-log", "service_log", serviceLogSchema],
      ["project", "projects", projectSchema],
      ["quote", "quotes", quoteSchema],
      ["vendor", "vendors", vendorSchema],
      ["appliance", "appliances", applianceSchema],
      ["incident", "incidents", incidentSchema],
    ] as const;
    for (const [entity, key, schema] of pairs) {
      const listed = await read(z.array(schema), ["db", entity, "list"]);
      const byId = (list: { id: string }[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
      expect(byId(everything[key]), entity).toEqual(byId(listed));
    }
  });

  it("reads what needs attention", async () => {
    const status = await micasa.getStatus(30);
    expect(status.overdue.length + status.upcoming.length).toBeGreaterThan(0);
    expect(status.incidents.length).toBeGreaterThan(0);
  });

  it("works out next-due dates the way micasa does", async () => {
    const [status, items] = await Promise.all([micasa.getStatus(365), micasa.listMaintenance()]);
    const byId = new Map(items.map((item) => [item.id, item]));
    const listed = [...status.overdue, ...status.upcoming];
    expect(listed.length).toBeGreaterThan(0);
    for (const entry of listed) {
      expect(nextDue(byId.get(entry.id)!)).toBe(entry.next_due);
    }
  });

  it("logs a service, which moves the item's next-due date", async () => {
    const item = (await micasa.listMaintenance()).find((each) => each.interval_months > 0)!;
    const entry = await micasa.logService({
      maintenance_item_id: item.id,
      serviced_at: "2026-11-02",
      cost_cents: 4500,
      notes: "Done",
      vendor_name: "A brand new vendor",
    });
    expect(calendarDate(entry.serviced_at)).toBe("2026-11-02");
    expect(entry.vendor).toBe("A brand new vendor");

    resetForTests();
    const after = await micasa.getMaintenance(item.id);
    expect(calendarDate(after.last_serviced_at)).toBe("2026-11-02");
    expect(nextDue(after)).not.toBe(nextDue(item));
  });

  it("adds a maintenance item and moves a project along", async () => {
    const [category] = await micasa.listCategories();
    const added = await micasa.addMaintenance({ name: "Flush water heater", category_id: category!.id, interval_months: 12 });
    expect(added.name).toBe("Flush water heater");
    expect(added.interval_months).toBe(12);

    const project = (await micasa.listProjects()).find((each) => each.status !== "underway")!;
    const moved = await micasa.editProject(project.id, { status: "underway" });
    expect(moved.status).toBe("underway");
    expect(moved.title).toBe(project.title);
  });

  it("passes micasa's own validation errors on, and says when a record isn't there", async () => {
    const [item] = await micasa.listMaintenance();
    await expect(micasa.logService({ maintenance_item_id: item!.id, serviced_at: "not a date" })).rejects.toThrow(
      /serviced_at: invalid date/,
    );
    const missing = await micasa.getMaintenance("01AAAAAAAAAAAAAAAAAAAAAAAA").catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(MicasaError);
    expect(micasa.isNotFound(missing)).toBe(true);
  });

  it("reads a document's file back", async () => {
    const [doc] = await micasa.listDocuments();
    const bytes = await micasa.getDocumentData(doc!.id);
    expect(bytes.length).toBe(doc!.size_bytes);
  });

  it("adds, edits, deletes and restores quotes, vendors and appliances", async () => {
    const project = (await micasa.listProjects())[0]!;
    const quote = await micasa.addQuote({ project_id: project.id, total_cents: 120000, labor_cents: 80000, vendor_name: "Quoted Ltd", received_date: "2026-11-01" });
    expect(quote).toMatchObject({ project_id: project.id, total_cents: 120000, vendor: "Quoted Ltd" });
    expect(calendarDate(quote.received_date)).toBe("2026-11-01");
    const edited = await micasa.editQuote(quote.id, { total_cents: 110000, received_date: null, notes: "Cheaper" });
    expect(edited).toMatchObject({ total_cents: 110000, notes: "Cheaper", received_date: null, vendor: "Quoted Ltd" });

    await micasa.deleteRecord("quote", quote.id);
    resetForTests();
    expect((await micasa.listQuotes()).some((each) => each.id === quote.id)).toBe(false);
    await micasa.restoreRecord("quote", quote.id);
    resetForTests();
    expect((await micasa.listQuotes()).some((each) => each.id === quote.id)).toBe(true);

    const vendor = await micasa.addVendor({ name: "Fix-it Felix", phone: "+34 600 000 000" });
    expect((await micasa.editVendor(vendor.id, { email: "felix@example.com" })).email).toBe("felix@example.com");
    const appliance = await micasa.addAppliance({ name: "Fridge", brand: "Cold Co", purchase_date: "2024-03-01", warranty_expiry: "2027-03-01", cost_cents: 89900 });
    expect(calendarDate(appliance.warranty_expiry)).toBe("2027-03-01");
    const moved = await micasa.editAppliance(appliance.id, { location: "Kitchen", warranty_expiry: null });
    expect(moved).toMatchObject({ location: "Kitchen", warranty_expiry: null, brand: "Cold Co" });
    await micasa.deleteRecord("appliance", appliance.id);
    await micasa.deleteRecord("vendor", vendor.id);
  });

  it("refuses to delete what other records depend on, and says why", async () => {
    const quotes = await micasa.listQuotes();
    const error = await micasa.deleteRecord("project", quotes[0]!.project_id).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MicasaError);
    expect((error as Error).message).toMatch(/^project has \d+ active quote\(s\) -- delete them first$/);
  });

  it("edits a logged service, and the house's systems and costs", async () => {
    const [entry] = await micasa.listServiceLog();
    const changed = await micasa.editService(entry!.id, { cost_cents: 999, notes: "Corrected" });
    expect(changed).toMatchObject({ cost_cents: 999, notes: "Corrected", maintenance_item_id: entry!.maintenance_item_id });

    await micasa.saveHouse({ heating_type: "Heat pump", insurance_renewal: "2027-01-15", property_tax_cents: 120000, hoa_fee_cents: null });
    resetForTests();
    const house = await micasa.getHouse();
    expect(house).toMatchObject({ heating_type: "Heat pump", property_tax_cents: 120000, hoa_fee_cents: null });
    expect(calendarDate(house.insurance_renewal ?? null)).toBe("2027-01-15");
  });

  it("attaches a file to a record, reads it back, renames it and deletes it", async () => {
    const appliance = (await micasa.listAppliances())[0]!;
    const dir = mkdtempSync(path.join(tmpdir(), "hestia-upload-"));
    const file = path.join(dir, "Fridge manual.pdf");
    writeFileSync(file, "%PDF-1.4 a tiny manual");
    const doc = await micasa.addDocument({ entity_kind: "appliance", entity_id: appliance.id, notes: "From the box" }, file);
    expect(doc).toMatchObject({ entity_kind: "appliance", entity_id: appliance.id, file_name: "Fridge manual.pdf", title: "Fridge Manual", mime_type: "application/pdf" });
    expect((await micasa.getDocumentData(doc.id)).toString()).toBe("%PDF-1.4 a tiny manual");
    expect((await micasa.editDocument(doc.id, { title: "Manual" })).title).toBe("Manual");
    await micasa.deleteRecord("document", doc.id);
    resetForTests();
    expect((await micasa.listDocuments()).some((each) => each.id === doc.id)).toBe(false);
  });

  it("makes a new, empty database on first run, in the chosen currency", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hestia-new-"));
    process.env.MICASA_DB_PATH = path.join(dir, "new.db");
    process.env.MICASA_LOCALE_CURRENCY = "EUR";
    resetForTests();
    try {
      expect((await micasa.listCategories()).length).toBeGreaterThan(0);
      expect(existsSync(process.env.MICASA_DB_PATH)).toBe(true);
      expect(await micasa.getHouse()).toEqual({});
      expect(await micasa.getCurrency()).toBe("EUR");
      expect(await micasa.listMaintenance()).toEqual([]);
    } finally {
      delete process.env.MICASA_LOCALE_CURRENCY;
    }
  });
});
