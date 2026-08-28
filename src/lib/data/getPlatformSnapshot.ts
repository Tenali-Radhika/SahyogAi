import "server-only";
import { loadSeedData } from "./loadSeedData";
import { generateAlerts } from "@/lib/forecast/alerts";
import { recommendRedistributions } from "@/lib/redistribution/engine";
import { simulateFederatedLearning } from "@/lib/federated/simulate";
import type { Alert, NationSilo, PHC, RedistributionRecommendation } from "@/types/domain";

export type StockHealth = "healthy" | "watch" | "at_risk";

export interface PhcStatus {
  phc: PHC;
  stockHealth: StockHealth;
  bedOccupancyRate: number;
  staffingRate: number;
  patientFootfall: number;
  activeAlertCount: number;
  criticalAlertCount: number;
}

export interface PlatformSnapshot {
  today: string;
  districts: ReturnType<typeof loadSeedData>["districts"];
  phcStatuses: PhcStatus[];
  alerts: Alert[];
  redistributions: RedistributionRecommendation[];
  nationSilos: NationSilo[];
}

let cached: PlatformSnapshot | null = null;

const FORECAST_SKUS = ["ORS-001", "PCM-002", "AMX-003", "DOXY-007", "ORVX-008"] as const;

export function getPlatformSnapshot(): PlatformSnapshot {
  if (cached) return cached;

  const { districts, phcs, stockByPhcSku, facilityByPhc, today } = loadSeedData();

  const alerts = generateAlerts({ phcs, districts, stockByPhcSku, facilityByPhc, today });
  const redistributions = recommendRedistributions(phcs, stockByPhcSku, alerts);
  const nationSilos = simulateFederatedLearning(phcs, stockByPhcSku, FORECAST_SKUS);

  const alertCountByPhc = new Map<string, { total: number; critical: number }>();
  for (const alert of alerts) {
    const entry = alertCountByPhc.get(alert.phcId) ?? { total: 0, critical: 0 };
    entry.total += 1;
    if (alert.severity === "critical") entry.critical += 1;
    alertCountByPhc.set(alert.phcId, entry);
  }

  const phcStatuses: PhcStatus[] = phcs.map((phc) => {
    const facilityRecords = (facilityByPhc.get(phc.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = facilityRecords[facilityRecords.length - 1];
    const counts = alertCountByPhc.get(phc.id) ?? { total: 0, critical: 0 };

    const stockHealth: StockHealth =
      counts.critical > 0 ? "at_risk" : counts.total > 0 ? "watch" : "healthy";

    return {
      phc,
      stockHealth,
      bedOccupancyRate: latest && phc.bedCapacity > 0 ? latest.bedsOccupied / phc.bedCapacity : 0,
      staffingRate: latest && phc.staffSanctioned > 0 ? latest.staffPresent / phc.staffSanctioned : 1,
      patientFootfall: latest?.patientFootfall ?? 0,
      activeAlertCount: counts.total,
      criticalAlertCount: counts.critical,
    };
  });

  cached = { today, districts, phcStatuses, alerts, redistributions, nationSilos };
  return cached;
}
