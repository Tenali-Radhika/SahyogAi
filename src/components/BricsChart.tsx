"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NationSilo } from "@/types/domain";

export function BricsChart({ silos }: { silos: NationSilo[] }) {
  const data = silos.map((s) => ({
    name: s.name,
    "Local model only": s.localMape,
    "Federated (shared) model": s.federatedMape,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--axis)" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={false}
          width={48}
          label={{ value: "MAPE % (lower is better)", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-muted)" }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-hairline)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Local model only" fill="var(--series-blue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Federated (shared) model" fill="var(--series-orange)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
