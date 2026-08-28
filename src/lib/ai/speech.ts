import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import type { FieldLanguageCode } from "@/lib/languages";

export { SUPPORTED_FIELD_LANGUAGES } from "@/lib/languages";
export type { FieldLanguageCode } from "@/lib/languages";

let speechClient: SpeechClient | null = null;
let ttsClient: TextToSpeechClient | null = null;

function getSpeechClient(): SpeechClient {
  if (!speechClient) speechClient = new SpeechClient();
  return speechClient;
}

function getTtsClient(): TextToSpeechClient {
  if (!ttsClient) ttsClient = new TextToSpeechClient();
  return ttsClient;
}

/** Transcribes a short WEBM/Opus voice note (as recorded by the browser MediaRecorder API). */
export async function transcribeFieldReport(
  audioContentBase64: string,
  languageCode: FieldLanguageCode
): Promise<string> {
  const client = getSpeechClient();
  const [response] = await client.recognize({
    audio: { content: audioContentBase64 },
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode,
      model: "default",
    },
  });

  return (
    response.results?.map((r) => r.alternatives?.[0]?.transcript ?? "").join(" ").trim() || ""
  );
}

/** Synthesizes a confirmation/alert message back in the field worker's language. */
export async function synthesizeSpeech(
  text: string,
  languageCode: FieldLanguageCode
): Promise<string> {
  const client = getTtsClient();
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode, ssmlGender: "NEUTRAL" },
    audioConfig: { audioEncoding: "MP3" },
  });

  const audioContent = response.audioContent;
  if (!audioContent) return "";
  const buffer = Buffer.isBuffer(audioContent) ? audioContent : Buffer.from(audioContent);
  return `data:audio/mp3;base64,${buffer.toString("base64")}`;
}
