import { describe, expect, it } from "vitest";

import type { LabReport, LabResult } from "./model";
import { homeOf, organStanding, testsByHome } from "./organs";

describe("lab tests on their organs", () => {
  it("knows a test's organ from its name, in English or Spanish", () => {
    const names = ["Glucose", "Glucosa", "Hemoglobina glicosilada (HbA1c)", "Hemoglobina", "Creatinina", "eGFR", "TSH", "T4 libre", "Colesterol LDL", "Triglicéridos", "GPT (ALT)", "GGT", "Bilirrubina total", "Sedimento de orina", "Ferritina", "Vitamin D"];
    expect(names.map(homeOf)).toEqual(["pancreas", "pancreas", "pancreas", "blood", "kidneys", "kidneys", "thyroid", "thyroid", "heart", "heart", "liver", "liver", "liver", "bladder", "blood", null]);
  });

  it("takes each test's latest result, and says when an organ has something out of range", () => {
    const report = (id: string, date: string): LabReport => ({ id, updatedAt: 1, deleted: false, date, lab: "", notes: "" });
    const result = (reportId: string, name: string, value: number, high: number): LabResult => ({
      id: `${reportId}-${name}`,
      updatedAt: 1,
      deleted: false,
      reportId,
      name,
      value,
      text: "",
      unit: "",
      low: null,
      high,
    });
    const byHome = testsByHome(
      [report("a", "2026-01-10"), report("b", "2026-10-30")],
      [result("a", "Glucose", 120, 99), result("b", "Glucose", 92, 99), result("b", "LDL", 160, 130), result("b", "HDL", 55, 100)],
    );
    expect(byHome.get("pancreas")!.map((test) => [test.result.value, test.flag])).toEqual([[92, "normal"]]);
    expect(organStanding(byHome.get("pancreas"))).toBe("in");
    expect(organStanding(byHome.get("heart"))).toBe("out");
    expect(organStanding(byHome.get("liver"))).toBeNull();
  });
});
