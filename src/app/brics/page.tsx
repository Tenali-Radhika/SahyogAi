import { getPlatformSnapshot } from "@/lib/data/getPlatformSnapshot";
import { BricsChart } from "@/components/BricsChart";

export default function BricsPage() {
  const { nationSilos } = getPlatformSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Shared predictive modelling across BRICS nations
        </h1>
        <p className="max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
          Forecasting accuracy improves when partner nations contribute aggregate demand signal to a shared
          model — without any raw facility- or patient-level data leaving their own infrastructure.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
        <BricsChart silos={nationSilos} />
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          India&apos;s system, with a full digitized history, barely moves — but the partner systems, modeled
          here as newly onboarded networks with only days of local data, see forecast error fall sharply once
          they incorporate the federated-averaged demand baseline, without any raw records crossing borders.
        </p>
      </div>

      <div
        className="rounded-xl border p-4 text-sm"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)", color: "var(--text-secondary)" }}
      >
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          How this simulation works
        </h2>
        <p className="mb-2">
          This demo does not have access to real South African or Brazilian PHC data, so the three
          &quot;national&quot; datasets shown here are partitions of the same demo dataset, relabeled as
          India, South Africa, and Brazil, with the partner silos additionally restricted to only their most
          recent few days of local history — standing in for a newly onboarded PHC network. What is genuinely
          computed — not fabricated — is the accuracy comparison: each silo&apos;s forecasting model is
          backtested twice against held-out days, once using only that silo&apos;s own (possibly short) history
          (&quot;local&quot;), and once shrunk toward a population-normalized, cross-silo demand baseline standing in
          for federated-averaged model parameters (&quot;federated&quot;) — the less local history a silo has, the
          more weight that shared baseline gets, mirroring how federated averaging helps small or new
          participants most.
        </p>
        <p>
          A production deployment would replace this in-process partition with each nation&apos;s own
          infrastructure, exchanging model updates through secure aggregation (e.g. Vertex AI training per
          silo + a coordinating aggregation service) — raw records would never cross the border, matching the
          cross-border applicability the challenge calls for.
        </p>
      </div>
    </div>
  );
}
