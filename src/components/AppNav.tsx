import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/redistribution", label: "Redistribution" },
  { href: "/field-report", label: "Field Report" },
  { href: "/brics", label: "BRICS Network" },
];

export function AppNav() {
  return (
    <header
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            SahyogAI
          </span>
          <span className="hidden text-xs sm:inline" style={{ color: "var(--text-muted)" }}>
            National PHC Resource &amp; Supply Chain Resilience
          </span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-black/5"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
