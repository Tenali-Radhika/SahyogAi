import { NextResponse } from "next/server";
import { transcribeFieldReport, synthesizeSpeech } from "@/lib/ai/speech";
import { structureVoiceReport } from "@/lib/ai/gemini";
import { MEDICINE_CATALOG } from "@/types/domain";
import { SUPPORTED_FIELD_LANGUAGES, type FieldLanguageCode } from "@/lib/languages";

export const runtime = "nodejs";

interface FieldReportRequest {
  audioBase64: string;
  languageCode: FieldLanguageCode;
}

export async function POST(req: Request) {
  let body: FieldReportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.audioBase64 || !body.languageCode) {
    return NextResponse.json({ error: "audioBase64 and languageCode are required" }, { status: 400 });
  }

  const languageLabel =
    SUPPORTED_FIELD_LANGUAGES.find((l) => l.code === body.languageCode)?.label ?? body.languageCode;

  try {
    const transcript = await transcribeFieldReport(body.audioBase64, body.languageCode);
    if (!transcript) {
      return NextResponse.json(
        { error: "Could not transcribe audio. Please try recording again, closer to the microphone." },
        { status: 422 }
      );
    }

    const structured = await structureVoiceReport(
      transcript,
      languageLabel,
      MEDICINE_CATALOG.map((m) => m.sku)
    );

    let confirmationAudio: string | null = null;
    try {
      confirmationAudio = await synthesizeSpeech(
        `Thank you. Your report has been recorded: ${structured.notes}`,
        body.languageCode
      );
    } catch {
      // Text-to-Speech is a nice-to-have confirmation; don't fail the whole request for it.
    }

    return NextResponse.json({ transcript, structured, confirmationAudio });
  } catch (error) {
    console.error("field-report ingest failed", error);
    return NextResponse.json(
      {
        error:
          "Voice ingestion is not configured in this environment yet. Set GOOGLE_APPLICATION_CREDENTIALS (Speech-to-Text/Text-to-Speech) and GEMINI_API_KEY to enable it.",
      },
      { status: 503 }
    );
  }
}
