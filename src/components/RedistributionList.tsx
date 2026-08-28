"use client";

import { useState } from "react";
import Link from "next/link";
import type { PHC, RedistributionRecommendation } from "@/types/domain";
import { StatusPill } from "./StatusPill";

export function RedistributionList({
  recommendations,
  phcById,
}: {
  recommendations: RedistributionRecommendation[];
  phcById: Map<string, PHC>;
}) {
  const [statuses, setStatuses] = useState<Record<string, RedistributionRecommendation["status"]>>(
    Object.fromEntries(recommendations.map((r) => [r.id, r.status]))
  );

  if (recommendations.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No redistribution needed right now — no PHC has both a deficit and a nearby surplus donor.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((rec) => {
        const from = phcById.get(rec.fromPhcId);
        const to = phcById.get(rec.toPhcId);
        const status = statuses[rec.id];

        return (
          <li
            key={rec.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {rec.quantity} units of {rec.sku} ·{" "}
                <Link href={`/phc/${from?.id}`} className="hover:underline">
                  {from?.name}
                </Link>{" "}
                →{" "}
                <Link href={`/phc/${to?.id}`} className="hover:underline">
                  {to?.name}
                </Link>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {rec.distanceKm} km
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {rec.rationale}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {status === "suggested" ? (
                <>
                  <button
                    onClick={() => setStatuses((s) => ({ ...s, [rec.id]: "approved" }))}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ background: "var(--brand-primary)" }}
                  >
                    Approve transfer
                  </button>
                  <button
                    onClick={() => setStatuses((s) => ({ ...s, [rec.id]: "rejected" }))}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: "var(--border-hairline)", color: "var(--text-secondary)" }}
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <StatusPill
                  status={status === "approved" ? "good" : "warning"}
                  label={status === "approved" ? "Approved" : "Dismissed"}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
