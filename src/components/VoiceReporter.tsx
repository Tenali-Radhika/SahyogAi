"use client";

import { useRef, useState } from "react";
import type { PHC } from "@/types/domain";
import { SUPPORTED_FIELD_LANGUAGES, type FieldLanguageCode } from "@/lib/languages";

interface FieldReportResult {
  transcript: string;
  structured: {
    translatedText: string;
    reportType: string;
    sku: string | null;
    quantityDelta: number | null;
    staffPresent: number | null;
    patientFootfall: number | null;
    notes: string;
  };
  confirmationAudio: string | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceReporter({ phcs }: { phcs: PHC[] }) {
  const [phcId, setPhcId] = useState(phcs[0]?.id ?? "");
  const [language, setLanguage] = useState<FieldLanguageCode>("hi-IN");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<FieldReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  async function startRecording() {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setError("Microphone access was denied or is unavailable in this browser.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function submitReport() {
    if (!audioBlobRef.current) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(audioBlobRef.current);
      const res = await fetch("/api/field-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, languageCode: language, phcId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong processing the report.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPreset(transcriptText: string, langCode: FieldLanguageCode) {
    setIsSubmitting(true);
    setError(null);
    setLanguage(langCode);
    try {
      const res = await fetch("/api/field-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textTranscript: transcriptText, languageCode: langCode, phcId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong processing the report.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick Demo Scenarios for Hackathon Reviewers */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>
            ⚡ 1-Click Multilingual Test Scenarios
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Instant evaluation without mic access
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              submitPreset(
                "हमें आज जिला डिपो से 250 ओआरएस पैकेट मिले हैं और 2 नर्स छुट्टी पर हैं।",
                "hi-IN"
              )
            }
            className="text-left p-2.5 rounded-lg border hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            <span className="font-semibold block text-slate-800">हिन्दी (Hindi) — Stock Intake</span>
            <span className="text-slate-500 line-clamp-1">&quot;हमें आज 250 ओआरएस पैकेट मिले...&quot;</span>
          </button>

          <button
            type="button"
            onClick={() =>
              submitPreset(
                "आज प्राथमिक आरोग्य केंद्रात 400 पॅरासिटामॉल गोळ्या आल्या आहेत आणि ओपीडीमध्ये 65 रुग्ण आले.",
                "mr-IN"
              )
            }
            className="text-left p-2.5 rounded-lg border hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            <span className="font-semibold block text-slate-800">मराठी (Marathi) — Medicine & OPD</span>
            <span className="text-slate-500 line-clamp-1">&quot;400 पॅरासिटामॉल गोळ्या आल्या...&quot;</span>
          </button>

          <button
            type="button"
            onClick={() =>
              submitPreset(
                "இன்று 150 அமோக்ஸிசிலின் மாத்திரைகள் பெறப்பட்டன, 1 மருத்துவர் விடுப்பில் உள்ளார்.",
                "ta-IN"
              )
            }
            className="text-left p-2.5 rounded-lg border hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            <span className="font-semibold block text-slate-800">தமிழ் (Tamil) — Antibiotic Inflow</span>
            <span className="text-slate-500 line-clamp-1">&quot;150 அமோக்ஸிசிலின் மாத்திரைகள்...&quot;</span>
          </button>

          <button
            type="button"
            onClick={() =>
              submitPreset(
                "Received 300 Doxycycline capsules this morning; staff attendance is 5 out of 6.",
                "en-IN"
              )
            }
            className="text-left p-2.5 rounded-lg border hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            <span className="font-semibold block text-slate-800">English (India) — Outbreak Prep</span>
            <span className="text-slate-500 line-clamp-1">&quot;Received 300 Doxycycline capsules...&quot;</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium" style={{ color: "var(--text-primary)" }}>
            PHC
          </span>
          <select
            value={phcId}
            onChange={(e) => setPhcId(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
          >
            {phcs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.state})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium" style={{ color: "var(--text-primary)" }}>
            Language
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as FieldLanguageCode)}
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
          >
            {SUPPORTED_FIELD_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="rounded-xl border p-6 text-center"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}
      >
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Or record a live voice note in your browser (MediaRecorder Opus + Cloud Speech-to-Text):
        </p>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
          style={{ background: isRecording ? "var(--status-critical)" : "var(--brand-primary)" }}
        >
          {isRecording ? "🔴 Stop recording" : "🎙️ Start recording"}
        </button>

        {audioUrl && !isRecording && (
          <div className="mt-4 space-y-3">
            <audio controls src={audioUrl} className="mx-auto" />
            <div>
              <button
                onClick={submitReport}
                disabled={isSubmitting}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--status-good)" }}
              >
                {isSubmitting ? "Submitting…" : "Submit voice report"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: "var(--border-hairline)", background: "rgba(208,59,59,0.08)", color: "var(--status-critical)" }}
        >
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-hairline)", background: "var(--surface-card)" }}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Structured report
          </h3>
          <p className="mb-3 text-sm italic" style={{ color: "var(--text-secondary)" }}>
            &quot;{result.structured.translatedText}&quot;
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Type</dt>
              <dd style={{ color: "var(--text-primary)" }}>{result.structured.reportType}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Medicine</dt>
              <dd style={{ color: "var(--text-primary)" }}>{result.structured.sku ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Quantity change</dt>
              <dd style={{ color: "var(--text-primary)" }}>{result.structured.quantityDelta ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--text-muted)" }}>Staff present</dt>
              <dd style={{ color: "var(--text-primary)" }}>{result.structured.staffPresent ?? "—"}</dd>
            </div>
          </dl>
          {result.confirmationAudio && (
            <audio controls src={result.confirmationAudio} className="mt-3" />
          )}
        </div>
      )}
    </div>
  );
}
