import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function buildAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return initializeApp({ credential: cert(JSON.parse(inlineJson)) });
  }

  // Falls back to GOOGLE_APPLICATION_CREDENTIALS or ambient GCP credentials
  // (Cloud Functions/Cloud Run runtime, or `gcloud auth application-default login` locally).
  return initializeApp({ credential: applicationDefault() });
}

export const adminApp = buildAdminApp();
export const adminDb = getFirestore(adminApp);
