import type { Organ } from "@atlas/body/organs";

import { labFlag, testKey } from "./health";
import type { LabReport, LabResult } from "./model";

// Which organ a lab test is about, from its name as printed, in English or
// Spanish ("Glucose", "Glucosa"). Blood counts are about the blood itself,
// so they're listed apart rather than placed. Anything else isn't placed.
// The more specific patterns come first: "hemoglobina glicosilada" is blood
// sugar, not a blood count.

export type Home = Organ | "blood";

const PATTERNS: [RegExp, Home][] = [
  [/hba1c|\ba1c\b|glicosilada|glicada|glycated|glucos|insulin|amyl|amilas|lipas|peptid/, "pancreas"],
  [/microalb|creatinin|\begfr\b|filtrado|glomerular|\burea\b|\bbun\b|uric|úrico|urico|cystatin|cistatina|sodium|sodio|potassium|potasio|chlorid|cloro/, "kidneys"],
  [/urine|orina|urinalysis|sedimento|uroanál|uroanal/, "bladder"],
  [/\btsh\b|\bt3\b|\bt4\b|thyro|tiro/, "thyroid"],
  [/cholester|colesterol|\bhdl\b|\bldl\b|triglycer|triglicér|triglicer|troponin|\bbnp\b|ck.?mb|lipoprot|apolipo|homociste/, "heart"],
  [/\balt\b|\bast\b|\bgpt\b|\bgot\b|\bggt\b|gamma.?gt|alkaline|fosfatasa|\balp\b|bilirub|bilirrub|albumin|albúmina|transamin/, "liver"],
  [/hemoglob|haemoglob|hematocr|haematocr|leuko|leuco|\bwbc\b|\brbc\b|platelet|plaquet|ferritin|ferritina|\biron\b|hierro|\bb12\b|folat|fólico|folico|\bmcv\b|\bvcm\b|neutro|lympho|linfo|eosin|monocit|monocyt|erythro|eritro|hematíe|hematie/, "blood"],
];

/** The organ (or the blood) a test is about; null if it isn't one Hygeia places. */
export function homeOf(name: string): Home | null {
  const text = name.toLowerCase();
  return PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export type TestStanding = { key: string; result: LabResult; report: LabReport; flag: ReturnType<typeof labFlag> };

/** Each test's latest result, by where it belongs. */
export function testsByHome(reports: LabReport[], results: LabResult[]): Map<Home, TestStanding[]> {
  const latest = new Map<string, TestStanding>();
  const alive = reports.filter((report) => !report.deleted).sort((a, b) => a.date.localeCompare(b.date));
  for (const report of alive) {
    for (const result of results.filter((each) => !each.deleted && each.reportId === report.id)) {
      latest.set(testKey(result.name), { key: testKey(result.name), result, report, flag: labFlag(result) });
    }
  }
  const byHome = new Map<Home, TestStanding[]>();
  for (const standing of latest.values()) {
    const home = homeOf(standing.result.name);
    if (!home) continue;
    byHome.set(home, [...(byHome.get(home) ?? []), standing].sort((a, b) => a.result.name.localeCompare(b.result.name)));
  }
  return byHome;
}

/** How an organ's latest results stand: something out of range, all within, or none to say. */
export function organStanding(tests: TestStanding[] | undefined): "out" | "in" | null {
  if (!tests?.length) return null;
  if (tests.some((test) => test.flag === "high" || test.flag === "low")) return "out";
  return "in";
}
