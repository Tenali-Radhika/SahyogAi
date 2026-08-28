// Core domain model for the national PHC resource & supply chain platform.

export type IndianState =
  | "Maharashtra"
  | "Uttar Pradesh"
  | "Karnataka"
  | "Bihar"
  | "Rajasthan";

export interface District {
  id: string;
  name: string;
  state: IndianState;
  lat: number;
  lng: number;
}

export interface PHC {
  id: string;
  name: string;
  districtId: string;
  state: IndianState;
  block: string;
  lat: number;
  lng: number;
  bedCapacity: number;
  staffSanctioned: number;
  /** Rough catchment population served, used to scale demand. */
  catchmentPopulation: number;
}

export const MEDICINE_CATALOG = [
  { sku: "ORS-001", name: "ORS Sachets", unit: "sachet" },
  { sku: "PCM-002", name: "Paracetamol 500mg", unit: "strip" },
  { sku: "AMX-003", name: "Amoxicillin 250mg", unit: "strip" },
  { sku: "IFA-004", name: "Iron & Folic Acid Tablets", unit: "strip" },
  { sku: "OXY-005", name: "Oxytocin Injection", unit: "vial" },
  { sku: "SNAKE-006", name: "Anti-Snake Venom", unit: "vial" },
  { sku: "DOXY-007", name: "Doxycycline 100mg", unit: "strip" },
  { sku: "ORVX-008", name: "Oral Rehydration + Zinc Kit", unit: "kit" },
  { sku: "INSU-009", name: "Insulin (Human, Regular)", unit: "vial" },
  { sku: "VACC-010", name: "DPT Vaccine", unit: "dose" },
] as const;

export type MedicineSku = (typeof MEDICINE_CATALOG)[number]["sku"];

export interface DailyStockRecord {
  id: string;
  phcId: string;
  date: string; // ISO date, yyyy-MM-dd
  sku: MedicineSku;
  openingStock: number;
  received: number;
  consumed: number;
  closingStock: number;
  reorderLevel: number;
}

export interface DailyFacilityRecord {
  id: string;
  phcId: string;
  date: string;
  bedsOccupied: number;
  staffPresent: number;
  staffSanctioned: number;
  patientFootfall: number;
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType = "stock_out_risk" | "low_staffing" | "bed_pressure" | "outbreak_signal";

export interface Alert {
  id: string;
  phcId: string;
  districtId: string;
  type: AlertType;
  severity: AlertSeverity;
  sku?: MedicineSku;
  createdAt: string; // ISO datetime
  daysToStockOut?: number;
  summary: string; // Gemini-authored plain-language explanation
  resolved: boolean;
}

export interface ForecastPoint {
  date: string;
  predictedDemand: number;
  lowerBound: number;
  upperBound: number;
}

export interface DemandForecast {
  phcId: string;
  sku: MedicineSku;
  generatedAt: string;
  horizonDays: number;
  points: ForecastPoint[];
  currentStock: number;
  projectedStockOutDate: string | null;
}

export interface RedistributionRecommendation {
  id: string;
  sku: MedicineSku;
  fromPhcId: string;
  toPhcId: string;
  quantity: number;
  distanceKm: number;
  rationale: string; // Gemini-authored rationale
  status: "suggested" | "approved" | "rejected" | "completed";
  createdAt: string;
}

export type NationCode = "IN" | "ZA" | "BR";

export interface NationSilo {
  code: NationCode;
  name: string;
  /** Simulated local model performance before federated averaging. */
  localMape: number;
  /** Simulated performance after incorporating the federated-averaged model. */
  federatedMape: number;
}

export type UserRole = "phc_staff" | "district_officer" | "national_admin";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  phcId?: string;
  districtId?: string;
}
