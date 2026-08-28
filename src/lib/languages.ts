// Client-safe language list — kept separate from lib/ai/speech.ts so client
// components can import it without pulling in @google-cloud/speech (Node-only).
export const SUPPORTED_FIELD_LANGUAGES = [
  { code: "hi-IN", label: "Hindi" },
  { code: "mr-IN", label: "Marathi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "kn-IN", label: "Kannada" },
  { code: "en-IN", label: "English (India)" },
] as const;

export type FieldLanguageCode = (typeof SUPPORTED_FIELD_LANGUAGES)[number]["code"];
