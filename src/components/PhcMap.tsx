"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhcStatus } from "@/lib/data/getPlatformSnapshot";
import { stockHealthToStatus } from "./StatusPill";

// Rough India bounding box for a simple equirectangular projection —
// good enough for a national overview scatter; swap for Google Maps
// Platform (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) for real basemap/routing.
const BOUNDS = { minLat: 8, maxLat: 32, minLng: 68, maxLng: 90 };
const WIDTH = 640;
const HEIGHT = 620;

const DOT_COLOR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
};

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * WIDTH;
  const y = HEIGHT - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * HEIGHT;
  return { x, y };
}

export function PhcMap({ statuses }: { statuses: PhcStatus[] }) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const points = useMemo(
    () =>
      statuses.map((s) => ({
        ...project(s.phc.lat, s.phc.lng),
        id: s.phc.id,
        name: s.phc.name,
        district: s.phc.districtId,
        status: stockHealthToStatus(s.stockHealth),
        criticalCount: s.criticalAlertCount,
      })),
    [statuses]
  );

  const hovered = points.find((p) => p.id === hoveredId) ?? null;

  return (
    <div className="relative rounded-xl border p-3" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Map of PHCs across India by stock health status">
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={12} fill="var(--surface-page)" />
        {points.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={hoveredId === p.id ? 7 : 5}
            fill={DOT_COLOR[p.status]}
            stroke="var(--surface-card)"
            strokeWidth={2}
            style={{ cursor: "pointer", transition: "r 120ms ease" }}
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === p.id ? null : cur))}
            onClick={() => router.push(`/phc/${p.id}`)}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute rounded-lg border px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: `${(hovered.y / HEIGHT) * 100}%`,
            transform: "translate(-50%, -130%)",
            background: "var(--surface-card)",
            borderColor: "var(--border-hairline)",
            color: "var(--text-primary)",
          }}
        >
          <div className="font-medium">{hovered.name}</div>
          {hovered.criticalCount > 0 && (
            <div style={{ color: "var(--status-critical)" }}>{hovered.criticalCount} critical alert(s)</div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLOR.good }} />
          Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLOR.warning }} />
          Watch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLOR.critical }} />
          At risk
        </span>
      </div>
    </div>
  );
}
