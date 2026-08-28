import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSeedData } from "@/lib/data/loadSeedData";
import { getPlatformSnapshot } from "@/lib/data/getPlatformSnapshot";
import { generateForecast, analyzeConsumption } from "@/lib/forecast/engine";
import { MEDICINE_CATALOG, type MedicineSku } from "@/types/domain";
import { StatusPill, severityToStatus } from "@/components/StatusPill";
import { AlertList } from "@/components/AlertList";
import { StockForecastChart, type StockChartPoint } from "@/components/StockForecastChart";

const HISTORY_DAYS_SHOWN = 30;

export default async function PhcDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sku?: string }>;
}) {
  const { id } = await params;
  const { sku: skuParam } = await searchParams;

  const { districts, phcs, stockByPhcSku, facilityByPhc } = loadSeedData();
  const { alerts } = getPlatformSnapshot();

  const phc = phcs.find((p) => p.id === id);
  if (!phc) notFound();
  const district = districts.find((d) => d.id === phc.districtId);

  const phcAlerts = alerts.filter((a) => a.phcId === phc.id);
  const alertBySku = new Map(phcAlerts.filter((a) => a.sku).map((a) => [a.sku, a]));

  const skuRows = MEDICINE_CATALOG.map((item) => {
    const records = stockByPhcSku.get(`${phc.id}::${item.sku}`) ?? [];
    const last = records[records.length - 1];
    const { anomalyRatio } = analyzeConsumption(records);
    const alert = alertBySku.get(item.sku);
    return {
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      currentStock: last?.closingStock ?? 0,
      reorderLevel: last?.reorderLevel ?? 0,
      anomalyRatio,
      alert,
    };
  }).sort((a, b) => {
    // Alerts first (critical before warning), soonest stock-out first.
    // No anomaly-ratio tiebreak: it's noise for low-volume items and
    // redundant with the alert itself for high-volume ones.
    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    if (!!a.alert !== !!b.alert) return a.alert ? -1 : 1;
    if (a.alert && b.alert) {
      return (
        severityRank[a.alert.severity] - severityRank[b.alert.severity] ||
        (a.alert.daysToStockOut ?? 99) - (b.alert.daysToStockOut ?? 99)
      );
    }
    return 0;
  });

  const selectedSku = (skuParam as MedicineSku) ?? skuRows[0]?.sku ?? MEDICINE_CATALOG[0].sku;
  const selectedRecords = (stockByPhcSku.get(`${phc.id}::${selectedSku}`) ?? []).slice().sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const chartData: StockChartPoint[] = selectedRecords
    .slice(-HISTORY_DAYS_SHOWN)
    .map((r) => ({ date: r.date.slice(5), actual: r.closingStock, forecast: null }));

  if (selectedRecords.length > 0) {
    const forecast = generateForecast(phc.id, selectedSku, selectedRecords);
    let projected = forecast.currentStock;
    if (chartData.length > 0) chartData[chartData.length - 1].forecast = projected;
    for (const point of forecast.points) {
      projected = Math.max(0, projected - point.predictedDemand);
      chartData.push({ date: point.date.slice(5), actual: null, forecast: projected });
    }
  }

  const selectedReorderLevel = selectedRecords[selectedRecords.length - 1]?.reorderLevel ?? 0;
  const selectedMedicineName = MEDICINE_CATALOG.find((m) => m.sku === selectedSku)?.name ?? selectedSku;

  const facilityRecords = (facilityByPhc.get(phc.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const latestFacility = facilityRecords[facilityRecords.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/" className="hover:underline">
            Dashboard
          </Link>{" "}
          / {district?.name}, {phc.state}
        </p>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {phc.name}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Block: {phc.block} · Catchment population: {phc.catchmentPopulation.toLocaleString("en-IN")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Bed occupancy
          </div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {latestFacility?.bedsOccupied ?? 0} / {phc.bedCapacity}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Staff present today
          </div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {latestFacility?.staffPresent ?? 0} / {phc.staffSanctioned}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Patient footfall today
          </div>
          <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {latestFacility?.patientFootfall ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Stock &amp; demand forecast — {selectedMedicineName}
          </h2>
        </div>
        <StockForecastChart data={chartData} reorderLevel={selectedReorderLevel} />
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
        <h2 className="px-4 pt-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Medicine stock
        </h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--border-hairline)", color: "var(--text-muted)" }}>
                <th className="px-4 py-2">Medicine</th>
                <th className="px-4 py-2">Current stock</th>
                <th className="px-4 py-2">Reorder level</th>
                <th className="px-4 py-2">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {skuRows.map((row) => (
                <tr key={row.sku} className="border-b last:border-0" style={{ borderColor: "var(--border-hairline)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                    {row.name}
                  </td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {row.currentStock} {row.unit}
                  </td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {row.reorderLevel}
                  </td>
                  <td className="px-4 py-2">
                    {row.alert ? (
                      <StatusPill status={severityToStatus(row.alert.severity)} label={`${row.alert.daysToStockOut}d left`} />
                    ) : (
                      <StatusPill status="good" label="Healthy" />
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/phc/${phc.id}?sku=${row.sku}`} className="text-xs font-medium hover:underline" style={{ color: "var(--brand-primary)" }}>
                      View forecast
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Alerts for this facility
        </h2>
        <AlertList alerts={phcAlerts} phcById={new Map([[phc.id, phc]])} />
      </div>
    </div>
  );
}
