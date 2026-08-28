import type {
  Alert,
  AlertSeverity,
  DailyFacilityRecord,
  DailyStockRecord,
  District,
  MedicineSku,
  PHC,
} from "@/types/domain";
import { MEDICINE_CATALOG } from "@/types/domain";
import { analyzeConsumption, generateForecast } from "./engine";
import { generateAlertSummary } from "@/lib/ai/gemini";

const medicineName = (sku: MedicineSku) =>
  MEDICINE_CATALOG.find((m) => m.sku === sku)?.name ?? sku;

function daysUntil(dateIso: string, fromIso: string): number {
  return Math.round((new Date(dateIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

function templateSummary(input: {
  phcName: string;
  medicineName?: string;
  alertType: Alert["type"];
  daysToStockOut?: number;
}): string {
  switch (input.alertType) {
    case "stock_out_risk":
      return `${input.medicineName} at ${input.phcName} is projected to run out in ${input.daysToStockOut} day(s) at the current consumption rate.`;
    case "bed_pressure":
      return `${input.phcName} is operating near full bed capacity.`;
    case "low_staffing":
      return `${input.phcName} is significantly below its sanctioned staffing today.`;
    case "outbreak_signal":
      return `Multiple facilities near ${input.phcName} show a coordinated spike in disease-related demand, consistent with a local outbreak.`;
    default:
      return `Attention needed at ${input.phcName}.`;
  }
}

export interface AlertInputs {
  phcs: PHC[];
  districts: District[];
  stockByPhcSku: Map<string, DailyStockRecord[]>; // key: `${phcId}::${sku}`
  facilityByPhc: Map<string, DailyFacilityRecord[]>; // key: phcId
  today: string; // yyyy-MM-dd
}

/** Pure, synchronous rule+forecast alert generation — no network calls, always available. */
export function generateAlerts(input: AlertInputs): Alert[] {
  const { phcs, districts, stockByPhcSku, facilityByPhc, today } = input;
  const districtById = new Map(districts.map((d) => [d.id, d]));
  const alerts: Alert[] = [];

  for (const phc of phcs) {
    for (const item of MEDICINE_CATALOG) {
      const key = `${phc.id}::${item.sku}`;
      const records = stockByPhcSku.get(key);
      if (!records || records.length < 20) continue;

      const { anomalyRatio, baselineMedianDaily } = analyzeConsumption(records);
      const forecast = generateForecast(phc.id, item.sku, records);

      if (!forecast.projectedStockOutDate) continue;
      const daysToStockOut = daysUntil(forecast.projectedStockOutDate, today);
      if (daysToStockOut > 14) continue;

      // Rare, low-volume items (anti-snake venom, oxytocin, vaccines) see
      // 0-2 units consumed on most days, where trend/anomaly-ratio statistics
      // are meaningless noise (one extra vial reads as a "4x spike") and
      // typical operating stock is itself only a handful of units. Real PHC
      // policy for these is a flat emergency buffer, not demand forecasting —
      // out of scope here, so they're left out of the statistical alert feed
      // rather than modeled badly.
      const LOW_VOLUME_THRESHOLD = 2;
      if (baselineMedianDaily < LOW_VOLUME_THRESHOLD) continue;

      // A routine periodic-resupply trough (normal sawtooth) vs. a genuine
      // abnormal depletion: require either an imminent stock-out or a clear
      // demand anomaly, so routine troughs don't spam the dashboard.
      const isImminent = daysToStockOut <= 5;
      const isAnomalous = anomalyRatio >= 1.5;
      if (!isImminent && !isAnomalous) continue;

      const severity: AlertSeverity =
        daysToStockOut <= 3 || anomalyRatio >= 2.5
          ? "critical"
          : daysToStockOut <= 7 || anomalyRatio >= 1.75
            ? "warning"
            : "info";

      alerts.push({
        id: `stock-${key}-${today}`,
        phcId: phc.id,
        districtId: phc.districtId,
        type: "stock_out_risk",
        severity,
        sku: item.sku,
        createdAt: new Date().toISOString(),
        daysToStockOut,
        summary: templateSummary({
          phcName: phc.name,
          medicineName: item.name,
          alertType: "stock_out_risk",
          daysToStockOut,
        }),
        resolved: false,
      });
    }

    const facilityRecords = (facilityByPhc.get(phc.id) ?? []).slice().sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const latest = facilityRecords[facilityRecords.length - 1];
    if (latest) {
      const occupancyRate = phc.bedCapacity > 0 ? latest.bedsOccupied / phc.bedCapacity : 0;
      if (occupancyRate >= 0.9) {
        alerts.push({
          id: `bed-${phc.id}-${today}`,
          phcId: phc.id,
          districtId: phc.districtId,
          type: "bed_pressure",
          severity: occupancyRate >= 0.98 ? "critical" : "warning",
          createdAt: new Date().toISOString(),
          summary: templateSummary({ phcName: phc.name, alertType: "bed_pressure" }),
          resolved: false,
        });
      }

      const staffingRate =
        latest.staffSanctioned > 0 ? latest.staffPresent / latest.staffSanctioned : 1;
      if (staffingRate <= 0.6) {
        alerts.push({
          id: `staff-${phc.id}-${today}`,
          phcId: phc.id,
          districtId: phc.districtId,
          type: "low_staffing",
          severity: staffingRate <= 0.45 ? "critical" : "warning",
          createdAt: new Date().toISOString(),
          summary: templateSummary({ phcName: phc.name, alertType: "low_staffing" }),
          resolved: false,
        });
      }
    }
  }

  // District-level outbreak signal: >=3 PHCs in the same district each showing
  // an anomalous spike across >=2 outbreak-sensitive SKUs.
  const districtStockOutCounts = new Map<string, Set<string>>();
  for (const alert of alerts) {
    if (alert.type !== "stock_out_risk") continue;
    const set = districtStockOutCounts.get(alert.districtId) ?? new Set<string>();
    set.add(alert.phcId);
    districtStockOutCounts.set(alert.districtId, set);
  }
  for (const [districtId, phcIds] of districtStockOutCounts) {
    if (phcIds.size < 3) continue;
    const district = districtById.get(districtId);
    const anchorPhc = phcs.find((p) => phcIds.has(p.id));
    if (!district || !anchorPhc) continue;
    alerts.push({
      id: `outbreak-${districtId}-${today}`,
      phcId: anchorPhc.id,
      districtId,
      type: "outbreak_signal",
      severity: "critical",
      createdAt: new Date().toISOString(),
      summary: templateSummary({ phcName: district.name, alertType: "outbreak_signal" }),
      resolved: false,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/** Replaces template summaries with Gemini-authored ones for the top N alerts (by severity). */
export async function enrichAlertsWithAI(
  alerts: Alert[],
  phcs: PHC[],
  districts: District[],
  stockByPhcSku: Map<string, DailyStockRecord[]>,
  limit = 25
): Promise<Alert[]> {
  const phcById = new Map(phcs.map((p) => [p.id, p]));
  const districtById = new Map(districts.map((d) => [d.id, d]));
  const target = alerts.slice(0, limit);

  const enriched = await Promise.all(
    target.map(async (alert) => {
      const phc = phcById.get(alert.phcId);
      const district = districtById.get(alert.districtId);
      if (!phc || !district) return alert;

      let trend = "stable";
      if (alert.sku) {
        const records = stockByPhcSku.get(`${alert.phcId}::${alert.sku}`);
        if (records) {
          const { anomalyRatio } = analyzeConsumption(records);
          trend =
            anomalyRatio >= 1.5
              ? `consumption is running ${anomalyRatio.toFixed(1)}x above the 60-day baseline`
              : "consumption is close to normal";
        }
      }

      try {
        const summary = await generateAlertSummary({
          phcName: phc.name,
          districtName: district.name,
          medicineName: alert.sku ? medicineName(alert.sku) : undefined,
          alertType: alert.type,
          daysToStockOut: alert.daysToStockOut,
          recentConsumptionTrend: trend,
        });
        return { ...alert, summary };
      } catch {
        return alert; // keep template summary if the AI call fails/no key configured
      }
    })
  );

  return [...enriched, ...alerts.slice(limit)];
}
