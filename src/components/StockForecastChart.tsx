"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface StockChartPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
}

export function StockForecastChart({
  data,
  reorderLevel,
}: {
  data: StockChartPoint[];
  reorderLevel: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={false}
          width={44}
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
        <ReferenceLine
          y={reorderLevel}
          stroke="var(--axis)"
          strokeDasharray="3 3"
          label={{ value: "Reorder level", position: "insideTopLeft", fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual stock"
          stroke="var(--series-blue)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Projected stock"
          stroke="var(--series-orange)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
