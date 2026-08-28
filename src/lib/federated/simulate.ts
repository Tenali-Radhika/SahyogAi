import type { DailyStockRecord, MedicineSku, NationCode, NationSilo, PHC } from "@/types/domain";
import { analyzeConsumption } from "@/lib/forecast/engine";

const HOLDOUT_DAYS = 14;
const SERIES_PER_SILO = 24;
// Shrinkage toward the federated prior: weight = K / (K + n), so a silo with
// only a handful of local training days (small n) leans heavily on the
// network-wide signal, while a data-rich silo (large n) is barely nudged —
// the actual mechanism by which federated averaging helps small/new
// participants without materially changing large ones.
const SHRINKAGE_K = 10;

/**
 * BRICS partners are simulated by partitioning this dataset into three
 * silos (round-robin by PHC) and labeling them as national systems — there
 * is no real South Africa/Brazil PHC data behind this. What IS real is the
 * computation: each silo's forecasting model is backtested twice, once
 * using only its own historical data ("local"), once blended with a
 * cross-silo demand signal computed WITHOUT pooling raw records ("federated")
 * — approximating federated averaging, where only aggregate statistics
 * (never patient- or facility-level data) cross the national boundary. The
 * partner silos are additionally capped to a short local history (see
 * localHistoryDays below), modeling a newly onboarded PHC network — the
 * realistic case where federated averaging provides the most lift, since a
 * short local window alone is too noisy to forecast well.
 * A production deployment would replace this in-process partition with real
 * per-nation infrastructure and secure aggregation between them.
 */
const SILO_LABELS: { code: NationCode; name: string; localHistoryDays: number | null }[] = [
  // India stands in for the data-rich system with a full digitized history.
  // The partner silos simulate newly onboarded PHC networks that have only
  // just started digitizing records — the realistic scenario where pooling
  // network-wide statistics (without pooling raw data) helps most.
  { code: "IN", name: "India", localHistoryDays: null },
  { code: "ZA", name: "South Africa (simulated)", localHistoryDays: 6 },
  { code: "BR", name: "Brazil (simulated)", localHistoryDays: 9 },
];

function mape(actual: number[], predicted: number[]): number {
  if (!actual.length) return 0;
  const errors = actual.map((a, i) => Math.abs(a - predicted[i]) / Math.max(a, 1));
  return (errors.reduce((s, e) => s + e, 0) / errors.length) * 100;
}

function backtestOne(
  records: DailyStockRecord[],
  globalPerCapitaBaseline: number | null,
  catchmentPopulation: number,
  localHistoryDays: number | null
): { local: number; federated: number } | null {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 40) return null;

  const trainEnd = sorted.length - HOLDOUT_DAYS;
  const fullTrain = sorted.slice(0, trainEnd);
  // Simulates a silo that has only just started digitizing records: its
  // local model can only see its own most recent N days, even though the
  // network-wide federated baseline below was learned from everyone's full
  // history.
  const train = localHistoryDays != null ? fullTrain.slice(-localHistoryDays) : fullTrain;
  const actual = sorted.slice(trainEnd).map((r) => r.consumed);

  const { recentAvgDaily, trendSlope } = analyzeConsumption(train);

  const localPredicted = actual.map((_, i) => Math.max(0, recentAvgDaily + trendSlope * (i + 1)));
  const local = mape(actual, localPredicted);

  // The federated signal borrows a network-wide *per-capita* demand rate
  // (scaled back to this PHC's own population) as a stabilizing prior on
  // top of its own recent trend — not a raw cross-PHC average, which would
  // be meaningless across facilities serving very different population
  // sizes, and not the live recent window, which would leak whatever
  // outbreak/anomaly is currently active elsewhere into unrelated regions.
  const globalSignal =
    globalPerCapitaBaseline != null ? globalPerCapitaBaseline * catchmentPopulation : recentAvgDaily;

  // Shrink both the level and the trend toward the federated prior. Shrinking
  // the trend matters as much as the level: a slope fit on a handful of days
  // is dominated by noise and compounds badly over a 14-day extrapolation,
  // and the network prior's implicit trend is "none" (a stable rate).
  const globalWeight = SHRINKAGE_K / (SHRINKAGE_K + train.length);
  const blendedAvg = (1 - globalWeight) * recentAvgDaily + globalWeight * globalSignal;
  const blendedTrend = (1 - globalWeight) * trendSlope;
  const federatedPredicted = actual.map((_, i) => Math.max(0, blendedAvg + blendedTrend * (i + 1)));
  const federated = mape(actual, federatedPredicted);

  return { local, federated };
}

export function simulateFederatedLearning(
  phcs: PHC[],
  stockByPhcSku: Map<string, DailyStockRecord[]>,
  skusToSample: readonly MedicineSku[]
): NationSilo[] {
  const phcById = new Map(phcs.map((p) => [p.id, p]));

  // Network-wide per-capita structural baseline per SKU, computed from each
  // series' pre-recent training window (holdout AND the last 14 days both
  // excluded) — this is what's actually "federated": a stable, population-
  // normalized demand rate, not a number contaminated by whatever regional
  // spike happens to be active right now.
  const globalPerCapitaBySku = new Map<MedicineSku, number>();
  for (const sku of skusToSample) {
    const rates: number[] = [];
    for (const phc of phcs) {
      const records = stockByPhcSku.get(`${phc.id}::${sku}`);
      if (!records || records.length < 40 || phc.catchmentPopulation <= 0) continue;
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const train = sorted.slice(0, sorted.length - HOLDOUT_DAYS);
      const { baselineMedianDaily } = analyzeConsumption(train);
      rates.push(baselineMedianDaily / phc.catchmentPopulation);
    }
    globalPerCapitaBySku.set(sku, rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0);
  }

  return SILO_LABELS.map(({ code, name, localHistoryDays }, siloIndex) => {
    const siloPhcs = phcs.filter((_, i) => i % SILO_LABELS.length === siloIndex);

    const results: { local: number; federated: number }[] = [];
    outer: for (const phc of siloPhcs) {
      for (const sku of skusToSample) {
        const records = stockByPhcSku.get(`${phc.id}::${sku}`);
        if (!records) continue;
        const target = phcById.get(phc.id);
        if (!target) continue;
        const result = backtestOne(
          records,
          globalPerCapitaBySku.get(sku) ?? null,
          target.catchmentPopulation,
          localHistoryDays
        );
        if (result) results.push(result);
        if (results.length >= SERIES_PER_SILO) break outer;
      }
    }

    const localMape = results.length ? results.reduce((s, r) => s + r.local, 0) / results.length : 0;
    const federatedMape = results.length ? results.reduce((s, r) => s + r.federated, 0) / results.length : 0;

    return { code, name, localMape: Math.round(localMape * 10) / 10, federatedMape: Math.round(federatedMape * 10) / 10 };
  });
}
