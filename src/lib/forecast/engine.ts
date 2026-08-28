import type { DailyStockRecord, DemandForecast, ForecastPoint } from "@/types/domain";
import { addDays, format, parseISO } from "date-fns";

const BASELINE_WINDOW = 60; // days used to establish "normal" consumption
const RECENT_WINDOW = 14; // days used to detect a current spike/anomaly
const DEFAULT_HORIZON_DAYS = 14;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Ordinary least squares slope of consumption over the recent window (units/day change). */
function linearTrendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);
  const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export interface ConsumptionAnomaly {
  baselineMedianDaily: number;
  recentAvgDaily: number;
  /** recentAvgDaily / baselineMedianDaily — 1.0 = normal, >1.5 = meaningful spike. */
  anomalyRatio: number;
  trendSlope: number;
}

/**
 * Local statistical forecasting model: robust baseline (median, to resist
 * being dragged up by the very spike we're trying to detect) vs. a recent
 * window, extrapolated with a linear trend. This is the model actually
 * driving the demo end-to-end. In production this call is swapped for a
 * Vertex AI Forecasting endpoint trained on the same series (see /ml) behind
 * the same function signature — nothing downstream changes.
 */
export function analyzeConsumption(records: DailyStockRecord[]): ConsumptionAnomaly {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-RECENT_WINDOW);
  const baseline = sorted.slice(-BASELINE_WINDOW, -RECENT_WINDOW);

  const baselineMedianDaily = median(baseline.map((r) => r.consumed)) || 1;
  const recentAvgDaily = mean(recent.map((r) => r.consumed));
  const trendSlope = linearTrendSlope(recent.map((r) => r.consumed));

  return {
    baselineMedianDaily,
    recentAvgDaily,
    anomalyRatio: recentAvgDaily / baselineMedianDaily,
    trendSlope,
  };
}

export function generateForecast(
  phcId: string,
  sku: DailyStockRecord["sku"],
  records: DailyStockRecord[],
  horizonDays: number = DEFAULT_HORIZON_DAYS
): DemandForecast {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const { recentAvgDaily, trendSlope } = analyzeConsumption(sorted);
  const recentStd = stdDev(sorted.slice(-RECENT_WINDOW).map((r) => r.consumed));

  const points: ForecastPoint[] = [];
  let cumulativeDemand = 0;
  let projectedStockOutDate: string | null = null;
  const currentStock = last?.closingStock ?? 0;
  const lastDate = last ? parseISO(last.date) : new Date();

  for (let i = 1; i <= horizonDays; i++) {
    const predicted = Math.max(0, recentAvgDaily + trendSlope * i);
    const uncertainty = recentStd * Math.sqrt(i);
    const date = format(addDays(lastDate, i), "yyyy-MM-dd");

    points.push({
      date,
      predictedDemand: Math.round(predicted),
      lowerBound: Math.max(0, Math.round(predicted - uncertainty)),
      upperBound: Math.round(predicted + uncertainty),
    });

    cumulativeDemand += predicted;
    if (projectedStockOutDate === null && cumulativeDemand >= currentStock) {
      projectedStockOutDate = date;
    }
  }

  return {
    phcId,
    sku,
    generatedAt: new Date().toISOString(),
    horizonDays,
    points,
    currentStock,
    projectedStockOutDate,
  };
}
