import Link from "next/link";
import type { Alert, PHC } from "@/types/domain";
import { StatusPill, severityToStatus } from "./StatusPill";

const TYPE_LABEL: Record<Alert["type"], string> = {
  stock_out_risk: "Stock-out risk",
  low_staffing: "Low staffing",
  bed_pressure: "Bed pressure",
  outbreak_signal: "Outbreak signal",
};

export function AlertList({ alerts, phcById }: { alerts: Alert[]; phcById: Map<string, PHC> }) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No active alerts.
      </p>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-hairline)" }}>
      {alerts.map((alert) => {
        const phc = phcById.get(alert.phcId);
        return (
          <li key={alert.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={severityToStatus(alert.severity)} label={TYPE_LABEL[alert.type]} />
                {phc && (
                  <Link href={`/phc/${phc.id}`} className="text-sm font-medium hover:underline" style={{ color: "var(--text-primary)" }}>
                    {phc.name}
                  </Link>
                )}
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {alert.summary}
              </p>
            </div>
            {alert.daysToStockOut != null && (
              <div className="shrink-0 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                {alert.daysToStockOut}d to stock-out
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
