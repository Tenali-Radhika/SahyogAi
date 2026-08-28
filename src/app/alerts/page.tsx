import { getPlatformSnapshot } from "@/lib/data/getPlatformSnapshot";
import { AlertList } from "@/components/AlertList";

export default function AlertsPage() {
  const { alerts, phcStatuses } = getPlatformSnapshot();
  const phcById = new Map(phcStatuses.map((s) => [s.phc.id, s.phc]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          All active alerts
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {alerts.length} alerts generated from live forecasting, bed-occupancy, and staffing signals.
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
      >
        <AlertList alerts={alerts} phcById={phcById} />
      </div>
    </div>
  );
}
