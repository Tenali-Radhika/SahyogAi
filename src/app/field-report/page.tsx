import { loadSeedData } from "@/lib/data/loadSeedData";
import { VoiceReporter } from "@/components/VoiceReporter";

export default function FieldReportPage() {
  const { phcs } = loadSeedData();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Voice field reporting
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          PHC staff can report stock receipts, consumption, and staff attendance by voice in their own
          language — no typing, no forms. Speech is transcribed with Cloud Speech-to-Text and understood by
          Gemini, which also translates it to English for the national dashboard.
        </p>
      </div>
      <VoiceReporter phcs={phcs} />
    </div>
  );
}
