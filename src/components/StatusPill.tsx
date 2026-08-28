const STATUS_STYLES = {
  good: { color: "var(--status-good)", bg: "rgba(12,163,12,0.1)", icon: "●" },
  warning: { color: "#8a5a00", bg: "rgba(250,178,25,0.18)", icon: "▲" },
  serious: { color: "#a1441f", bg: "rgba(236,131,90,0.16)", icon: "▲" },
  critical: { color: "var(--status-critical)", bg: "rgba(208,59,59,0.1)", icon: "■" },
} as const;

export type StatusKind = keyof typeof STATUS_STYLES;

export function StatusPill({ status, label }: { status: StatusKind; label: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: style.color, background: style.bg }}
    >
      <span aria-hidden style={{ fontSize: "0.6rem" }}>
        {style.icon}
      </span>
      {label}
    </span>
  );
}

export function stockHealthToStatus(health: "healthy" | "watch" | "at_risk"): StatusKind {
  if (health === "at_risk") return "critical";
  if (health === "watch") return "warning";
  return "good";
}

export function severityToStatus(severity: "critical" | "warning" | "info"): StatusKind {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "good";
}
