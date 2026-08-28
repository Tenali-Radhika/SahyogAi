export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "critical" | "warning";
}) {
  const valueColor =
    tone === "critical" ? "var(--status-critical)" : tone === "warning" ? "#8a5a00" : "var(--text-primary)";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
