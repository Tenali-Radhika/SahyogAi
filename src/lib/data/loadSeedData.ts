import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DailyFacilityRecord, DailyStockRecord, District, PHC } from "@/types/domain";

const SEED_DIR = path.join(process.cwd(), "data", "seed");

export interface SeedData {
  districts: District[];
  phcs: PHC[];
  stockByPhcSku: Map<string, DailyStockRecord[]>;
  facilityByPhc: Map<string, DailyFacilityRecord[]>;
  today: string;
}

let cached: SeedData | null = null;

/**
 * Reads the generated demo dataset from disk once per server process and
 * indexes it for fast lookup. This is the "local mode" data layer used by
 * every API route until the app is pointed at a live Firestore project
 * (scripts/seed-firestore.ts loads this same data there).
 */
export function loadSeedData(): SeedData {
  if (cached) return cached;

  const districts: District[] = JSON.parse(readFileSync(path.join(SEED_DIR, "districts.json"), "utf-8"));
  const phcs: PHC[] = JSON.parse(readFileSync(path.join(SEED_DIR, "phcs.json"), "utf-8"));
  const stockRecords: DailyStockRecord[] = JSON.parse(
    readFileSync(path.join(SEED_DIR, "stock-records.json"), "utf-8")
  );
  const facilityRecords: DailyFacilityRecord[] = JSON.parse(
    readFileSync(path.join(SEED_DIR, "facility-records.json"), "utf-8")
  );

  const stockByPhcSku = new Map<string, DailyStockRecord[]>();
  for (const r of stockRecords) {
    const key = `${r.phcId}::${r.sku}`;
    const list = stockByPhcSku.get(key);
    if (list) list.push(r);
    else stockByPhcSku.set(key, [r]);
  }

  const facilityByPhc = new Map<string, DailyFacilityRecord[]>();
  for (const r of facilityRecords) {
    const list = facilityByPhc.get(r.phcId);
    if (list) list.push(r);
    else facilityByPhc.set(r.phcId, [r]);
  }

  let today = stockRecords[0]?.date ?? "";
  for (const r of stockRecords) if (r.date > today) today = r.date;

  cached = { districts, phcs, stockByPhcSku, facilityByPhc, today };
  return cached;
}
