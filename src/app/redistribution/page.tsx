import { getPlatformSnapshot } from "@/lib/data/getPlatformSnapshot";
import { RedistributionList } from "@/components/RedistributionList";

export default function RedistributionPage() {
  const { redistributions, phcStatuses } = getPlatformSnapshot();
  const phcById = new Map(phcStatuses.map((s) => [s.phc.id, s.phc]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Cross-district redistribution recommendations
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {redistributions.length} suggested transfers, matched by nearest facility holding a comfortable
          surplus of the same medicine.
        </p>
      </div>

      <RedistributionList recommendations={redistributions} phcById={phcById} />
    </div>
  );
}
