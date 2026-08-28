import type { Alert, DailyStockRecord, MedicineSku, PHC, RedistributionRecommendation } from "@/types/domain";
import { haversineKm } from "@/lib/geo";
import { analyzeConsumption } from "@/lib/forecast/engine";
import { generateRedistributionRationale } from "@/lib/ai/gemini";

const MAX_DISTANCE_KM = 300;
// The demo's resupply policy targets an ~18-day buffer against a 10-day
// reorder level, so steady-state stock normally sits around 1-1.5x reorder
// level, not 2x+ — a flat "2x surplus" bar would almost never be met and
// silently starve the recommender. 1.3x/1.1x still requires a real (if
// modest) cushion above what the PHC needs for itself.
const DONOR_SURPLUS_MULTIPLE = 1.3; // must hold >1.3x its own reorder level to qualify as a donor
const DONOR_RESERVE_MULTIPLE = 1.1; // keeps 1.1x reorder level for itself after donating

interface DeficitCandidate {
  phc: PHC;
  sku: MedicineSku;
  shortfall: number;
  daysToStockOut: number;
  urgencyRank: number;
}

interface DonorCandidate {
  phc: PHC;
  sku: MedicineSku;
  availableSurplus: number;
}

function templateRationale(input: {
  quantity: number;
  sku: string;
  fromName: string;
  toName: string;
  distanceKm: number;
}): string {
  return `${input.fromName} has surplus ${input.sku} stock; redirecting ${input.quantity} units to ${input.toName} (${input.distanceKm.toFixed(0)} km) closes its projected gap faster than waiting for the next scheduled resupply.`;
}

/**
 * Matches PHCs at stock-out risk (from `alerts`) against nearby PHCs holding
 * a comfortable surplus of the same medicine, greedily by urgency and
 * distance. Pure/sync — no network calls — so it always produces
 * recommendations even without AI credentials configured.
 */
export function recommendRedistributions(
  phcs: PHC[],
  stockByPhcSku: Map<string, DailyStockRecord[]>,
  alerts: Alert[]
): RedistributionRecommendation[] {
  const phcById = new Map(phcs.map((p) => [p.id, p]));
  const deficitAlerts = alerts.filter(
    (a) => a.type === "stock_out_risk" && a.sku && (a.severity === "critical" || a.severity === "warning")
  );

  const deficits: DeficitCandidate[] = deficitAlerts
    .map((alert) => {
      const phc = phcById.get(alert.phcId);
      const sku = alert.sku as MedicineSku;
      const records = stockByPhcSku.get(`${alert.phcId}::${sku}`);
      if (!phc || !records?.length) return null;
      const last = records[records.length - 1];
      const { recentAvgDaily } = analyzeConsumption(records);
      const targetBuffer = Math.round(recentAvgDaily * 14);
      const shortfall = Math.max(1, targetBuffer - last.closingStock);
      return {
        phc,
        sku,
        shortfall,
        daysToStockOut: alert.daysToStockOut ?? 999,
        urgencyRank: alert.severity === "critical" ? 0 : 1,
      };
    })
    .filter((d): d is DeficitCandidate => d !== null)
    .sort((a, b) => a.urgencyRank - b.urgencyRank || a.daysToStockOut - b.daysToStockOut);

  const deficitPhcSkuSet = new Set(deficits.map((d) => `${d.phc.id}::${d.sku}`));

  // Build donor pool per SKU once, then deplete as matches are made.
  const donorsBySku = new Map<MedicineSku, DonorCandidate[]>();
  for (const [key, records] of stockByPhcSku.entries()) {
    const [phcId, sku] = key.split("::") as [string, MedicineSku];
    if (deficitPhcSkuSet.has(key)) continue; // a PHC already short on this SKU can't be a donor for it
    const phc = phcById.get(phcId);
    if (!phc || !records.length) continue;

    const last = records[records.length - 1];
    if (last.reorderLevel <= 0) continue;
    if (last.closingStock < last.reorderLevel * DONOR_SURPLUS_MULTIPLE) continue;

    const availableSurplus = Math.round(last.closingStock - last.reorderLevel * DONOR_RESERVE_MULTIPLE);
    if (availableSurplus <= 0) continue;

    const list = donorsBySku.get(sku) ?? [];
    list.push({ phc, sku, availableSurplus });
    donorsBySku.set(sku, list);
  }

  const recommendations: RedistributionRecommendation[] = [];

  for (const deficit of deficits) {
    const donors = (donorsBySku.get(deficit.sku) ?? [])
      .filter((d) => d.availableSurplus > 0)
      .map((d) => ({ ...d, distanceKm: haversineKm(deficit.phc, d.phc) }))
      .filter((d) => d.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const donor = donors[0];
    if (!donor) continue;

    const quantity = Math.min(deficit.shortfall, donor.availableSurplus);
    if (quantity <= 0) continue;

    donor.availableSurplus -= quantity;
    // Persist the depletion back onto the shared pool entry.
    const poolEntry = donorsBySku.get(deficit.sku)?.find((d) => d.phc.id === donor.phc.id);
    if (poolEntry) poolEntry.availableSurplus = donor.availableSurplus;

    recommendations.push({
      id: `redist-${deficit.phc.id}-${deficit.sku}-${donor.phc.id}`,
      sku: deficit.sku,
      fromPhcId: donor.phc.id,
      toPhcId: deficit.phc.id,
      quantity,
      distanceKm: Math.round(donor.distanceKm * 10) / 10,
      rationale: templateRationale({
        quantity,
        sku: deficit.sku,
        fromName: donor.phc.name,
        toName: deficit.phc.name,
        distanceKm: donor.distanceKm,
      }),
      status: "suggested",
      createdAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

export async function enrichRecommendationsWithAI(
  recommendations: RedistributionRecommendation[],
  phcs: PHC[],
  alertsByPhcSku: Map<string, Alert>,
  limit = 20
): Promise<RedistributionRecommendation[]> {
  const phcById = new Map(phcs.map((p) => [p.id, p]));
  const target = recommendations.slice(0, limit);

  const enriched = await Promise.all(
    target.map(async (rec) => {
      const fromPhc = phcById.get(rec.fromPhcId);
      const toPhc = phcById.get(rec.toPhcId);
      if (!fromPhc || !toPhc) return rec;

      const toAlert = alertsByPhcSku.get(`${rec.toPhcId}::${rec.sku}`);
      try {
        const rationale = await generateRedistributionRationale({
          sku: rec.sku,
          quantity: rec.quantity,
          fromPhcName: fromPhc.name,
          toPhcName: toPhc.name,
          distanceKm: rec.distanceKm,
          toPhcDaysToStockOut: toAlert?.daysToStockOut,
        });
        return { ...rec, rationale };
      } catch {
        return rec;
      }
    })
  );

  return [...enriched, ...recommendations.slice(limit)];
}
