import { GoogleGenAI, Type } from "@google/genai";
import type { Alert } from "@/types/domain";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

/**
 * Single entry point for all Gemini calls. Switches between the Gemini
 * Developer API (hackathon/dev, API-key auth) and Vertex AI (production,
 * project/location auth) based on USE_VERTEX_AI — the rest of the app
 * never needs to know which backend is in use.
 */
export function getGenAIClient(): GoogleGenAI {
  if (client) return client;

  if (process.env.USE_VERTEX_AI === "true") {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    });
  } else {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export async function generateAlertSummary(input: {
  phcName: string;
  districtName: string;
  medicineName?: string;
  alertType: Alert["type"];
  daysToStockOut?: number;
  recentConsumptionTrend: string;
}): Promise<string> {
  const ai = getGenAIClient();
  const prompt = `You are writing a short, plain-language alert for a district health officer in India.
Facility: ${input.phcName}, ${input.districtName}
Alert type: ${input.alertType}
${input.medicineName ? `Medicine: ${input.medicineName}` : ""}
${input.daysToStockOut != null ? `Projected days until stock-out: ${input.daysToStockOut}` : ""}
Recent trend: ${input.recentConsumptionTrend}

Write 1-2 sentences a busy officer can act on immediately. No preamble, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  return response.text?.trim() || "Alert summary unavailable.";
}

export async function generateRedistributionRationale(input: {
  sku: string;
  quantity: number;
  fromPhcName: string;
  toPhcName: string;
  distanceKm: number;
  toPhcDaysToStockOut?: number;
}): Promise<string> {
  const ai = getGenAIClient();
  const prompt = `Explain in 1 sentence why moving ${input.quantity} units of ${input.sku} from
${input.fromPhcName} to ${input.toPhcName} (${input.distanceKm.toFixed(1)} km apart) is recommended.
${input.toPhcDaysToStockOut != null ? `${input.toPhcName} is projected to run out in ${input.toPhcDaysToStockOut} days.` : ""}
Write for a district supply officer approving the transfer. No preamble.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  return response.text?.trim() || "Redistribution rationale unavailable.";
}

export interface StructuredFieldReport {
  translatedText: string;
  reportType: "stock_update" | "attendance_update" | "mixed" | "unclear";
  sku: string | null;
  quantityDelta: number | null;
  staffPresent: number | null;
  patientFootfall: number | null;
  notes: string;
}

/**
 * Turns a raw transcribed voice report from PHC field staff (in any Indian
 * language Cloud Speech-to-Text supports) into an English translation plus a
 * structured update the ingestion pipeline can write to Firestore — one
 * Gemini call handles both translation and extraction since the model is
 * natively multilingual.
 */
export async function structureVoiceReport(
  rawTranscript: string,
  sourceLanguageLabel: string,
  medicineSkuList: readonly string[]
): Promise<StructuredFieldReport> {
  const ai = getGenAIClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `A Primary Health Centre worker in India recorded this field report in ${sourceLanguageLabel}:
"${rawTranscript}"

Valid medicine SKUs: ${medicineSkuList.join(", ")}

Translate it to English and extract a structured update. If a medicine is mentioned, match it to the closest valid SKU or set sku to null if unclear.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: { type: Type.STRING },
          reportType: {
            type: Type.STRING,
            enum: ["stock_update", "attendance_update", "mixed", "unclear"],
          },
          sku: { type: Type.STRING, nullable: true },
          quantityDelta: { type: Type.NUMBER, nullable: true },
          staffPresent: { type: Type.NUMBER, nullable: true },
          patientFootfall: { type: Type.NUMBER, nullable: true },
          notes: { type: Type.STRING },
        },
        required: ["translatedText", "reportType", "notes"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as StructuredFieldReport;
}

export async function answerOfficerQuery(question: string, contextJson: string): Promise<string> {
  const ai = getGenAIClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are a supply-chain assistant for India's national PHC network.
Context data (JSON): ${contextJson}

Officer question: ${question}

Answer concisely using only the context provided. If the context doesn't contain the answer, say so.`,
  });
  return response.text?.trim() || "No answer available.";
}
