import { getPlatformSnapshot } from "@/lib/data/getPlatformSnapshot";
import { StatCard } from "@/components/StatCard";
import { PhcMap } from "@/components/PhcMap";
import { AlertList } from "@/components/AlertList";
import Link from "next/link";

export default function DashboardPage() {
  const { today, phcStatuses, alerts, districts } = getPlatformSnapshot();
  const phcById = new Map(phcStatuses.map((s) => [s.phc.id, s.phc]));

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const atRiskPhcCount = phcStatuses.filter((s) => s.stockHealth === "at_risk").length;
  const districtsAffected = new Set(
    alerts.filter((a) => a.severity === "critical").map((a) => a.districtId)
  ).size;

  const topAlerts = alerts.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          National PHC Network — Live Status
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {phcStatuses.length} PHCs across {districts.length} districts, {new Set(districts.map((d) => d.state)).size} states · as of {today}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Critical alerts" value={criticalCount} tone={criticalCount > 0 ? "critical" : "default"} />
        <StatCard label="Warning alerts" value={warningCount} tone={warningCount > 0 ? "warning" : "default"} />
        <StatCard label="PHCs at risk" value={atRiskPhcCount} tone={atRiskPhcCount > 0 ? "critical" : "default"} />
        <StatCard label="Districts affected" value={districtsAffected} tone={districtsAffected > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <PhcMap statuses={phcStatuses} />

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Highest-priority alerts
            </h2>
            <Link href="/alerts" className="text-xs font-medium hover:underline" style={{ color: "var(--brand-primary)" }}>
              View all →
            </Link>
          </div>
          <AlertList alerts={topAlerts} phcById={phcById} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/redistribution"
          className="rounded-xl border p-4 transition-colors hover:bg-black/[0.02]"
          style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Redistribution recommendations →
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            AI-matched surplus-to-deficit medicine transfers between nearby PHCs.
          </p>
        </Link>
        <Link
          href="/field-report"
          className="rounded-xl border p-4 transition-colors hover:bg-black/[0.02]"
          style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Voice field reporting →
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            PHC staff report stock and attendance by voice in their own language.
          </p>
        </Link>
        <Link
          href="/brics"
          className="rounded-xl border p-4 transition-colors hover:bg-black/[0.02]"
          style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            BRICS shared modelling →
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Federated forecasting accuracy across simulated partner nations.
          </p>
        </Link>
      </div>
    </div>
  );
}
