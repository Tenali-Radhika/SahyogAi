/**
 * Generates the full synthetic operational dataset for the demo:
 * ~180 days of daily medicine stock + facility records for every PHC,
 * with a scripted monsoon waterborne-disease outbreak in the last 21 days
 * across two districts (Gorakhpur, UP and Purnia, Bihar) so the
 * forecasting/early-warning/redistribution engines all have something real
 * to catch when judges open the live demo.
 *
 * Run: npm run generate-data
 * Output: data/seed/{districts,phcs,stock-records,facility-records}.json
 *         plus CSV mirrors for BigQuery/Vertex AI training upload.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { addDays, differenceInCalendarDays, format, startOfYear } from "date-fns";
import { DISTRICTS, OUTBREAK_DISTRICT_IDS } from "../src/data/geography";
import { PHCS } from "../src/data/phcs";
import { MEDICINE_CATALOG, type MedicineSku } from "../src/types/domain";
import { mulberry32, hashStringToSeed, randInt, gaussianNoise } from "../src/lib/rng";

const HISTORY_DAYS = 180;
const OUTBREAK_DAYS = 21;
const TODAY = new Date(); // demo "current" date — matches system clock
const START_DATE = addDays(TODAY, -(HISTORY_DAYS - 1));
const OUTBREAK_START = addDays(TODAY, -(OUTBREAK_DAYS - 1));

const SKU_PROFILE: Record<
  MedicineSku,
  { baseRatePerCapitaPerDay: number; outbreakSensitive: boolean; peakMultiplier: number; seasonalPhase: number }
> = {
  "ORS-001": { baseRatePerCapitaPerDay: 0.002, outbreakSensitive: true, peakMultiplier: 4.5, seasonalPhase: 0 },
  "PCM-002": { baseRatePerCapitaPerDay: 0.0008, outbreakSensitive: true, peakMultiplier: 2.0, seasonalPhase: 0.3 },
  "AMX-003": { baseRatePerCapitaPerDay: 0.0004, outbreakSensitive: true, peakMultiplier: 2.5, seasonalPhase: 0.3 },
  "IFA-004": { baseRatePerCapitaPerDay: 0.0006, outbreakSensitive: false, peakMultiplier: 1, seasonalPhase: 1.2 },
  "OXY-005": { baseRatePerCapitaPerDay: 0.00003, outbreakSensitive: false, peakMultiplier: 1, seasonalPhase: 0 },
  "SNAKE-006": { baseRatePerCapitaPerDay: 0.00001, outbreakSensitive: false, peakMultiplier: 1, seasonalPhase: 1.6 },
  "DOXY-007": { baseRatePerCapitaPerDay: 0.0003, outbreakSensitive: true, peakMultiplier: 3.5, seasonalPhase: 0 },
  "ORVX-008": { baseRatePerCapitaPerDay: 0.0015, outbreakSensitive: true, peakMultiplier: 4.0, seasonalPhase: 0 },
  "INSU-009": { baseRatePerCapitaPerDay: 0.0002, outbreakSensitive: false, peakMultiplier: 1, seasonalPhase: 0.6 },
  "VACC-010": { baseRatePerCapitaPerDay: 0.00005, outbreakSensitive: false, peakMultiplier: 1, seasonalPhase: 0.9 },
};

function outbreakMultiplier(dayIndexInOutbreak: number, peak: number): number {
  if (dayIndexInOutbreak < 0 || dayIndexInOutbreak >= OUTBREAK_DAYS) return 1;
  // Ramp up over first 7 days, hold peak, no ramp-down (outbreak is still active "today").
  const ramp = Math.min(1, dayIndexInOutbreak / 7);
  return 1 + (peak - 1) * ramp;
}

interface StockRow {
  id: string;
  phcId: string;
  date: string;
  sku: MedicineSku;
  openingStock: number;
  received: number;
  consumed: number;
  closingStock: number;
  reorderLevel: number;
}

interface FacilityRow {
  id: string;
  phcId: string;
  date: string;
  bedsOccupied: number;
  staffPresent: number;
  staffSanctioned: number;
  patientFootfall: number;
}

function generateForPhc(phc: (typeof PHCS)[number]) {
  const rand = mulberry32(hashStringToSeed(phc.id));
  const isOutbreakDistrict = OUTBREAK_DISTRICT_IDS.includes(phc.districtId);
  const leadTimeDays = randInt(rand, 4, 8);
  const resupplyOffset = randInt(rand, 0, 6);

  const stockRows: StockRow[] = [];
  const facilityRows: FacilityRow[] = [];

  for (const item of MEDICINE_CATALOG) {
    const sku = item.sku;
    const profile = SKU_PROFILE[sku];
    const baseDaily = Math.max(0.5, phc.catchmentPopulation * profile.baseRatePerCapitaPerDay);
    const reorderLevel = Math.round(baseDaily * 10);
    let stock = Math.round(baseDaily * randInt(rand, 20, 35));
    const pendingDeliveries = new Map<number, number>(); // dayIndex -> qty arriving

    const trailingConsumption: number[] = [];

    for (let dayIndex = 0; dayIndex < HISTORY_DAYS; dayIndex++) {
      const date = addDays(START_DATE, dayIndex);
      const dayOfYear = differenceInCalendarDays(date, startOfYear(date)) + 1;
      const seasonal = 1 + 0.15 * Math.sin((2 * Math.PI * dayOfYear) / 365 + profile.seasonalPhase);
      const weekday = date.getDay() === 0 ? 0.8 : 1;

      const daysIntoOutbreak = differenceInCalendarDays(date, OUTBREAK_START);
      const outbreakFactor =
        isOutbreakDistrict && profile.outbreakSensitive
          ? outbreakMultiplier(daysIntoOutbreak, profile.peakMultiplier)
          : 1;

      const desiredConsumption = Math.max(
        0,
        Math.round(gaussianNoise(rand, baseDaily * seasonal * weekday * outbreakFactor, baseDaily * 0.12))
      );

      const opening = stock;
      const received = pendingDeliveries.get(dayIndex) ?? 0;
      const available = opening + received;
      const consumed = Math.min(desiredConsumption, available);
      const closing = available - consumed;
      stock = closing;

      trailingConsumption.push(consumed);
      if (trailingConsumption.length > 14) trailingConsumption.shift();

      // Weekly resupply order, sized to a ~18-day buffer based on trailing demand, arriving after lead time.
      if (dayIndex % 7 === resupplyOffset) {
        const avgDaily =
          trailingConsumption.reduce((a, b) => a + b, 0) / Math.max(1, trailingConsumption.length);
        const targetBuffer = Math.round(avgDaily * 18);
        const orderQty = Math.max(0, targetBuffer - closing);
        if (orderQty > 0) {
          const arrivalDay = dayIndex + leadTimeDays;
          pendingDeliveries.set(arrivalDay, (pendingDeliveries.get(arrivalDay) ?? 0) + orderQty);
        }
      }

      stockRows.push({
        id: `${phc.id}-${sku}-${format(date, "yyyy-MM-dd")}`,
        phcId: phc.id,
        date: format(date, "yyyy-MM-dd"),
        sku,
        openingStock: opening,
        received,
        consumed,
        closingStock: closing,
        reorderLevel,
      });
    }
  }

  const baselineOccupancyRate = 0.4 + rand() * 0.25;
  const baselineAttendanceRate = 0.85 + rand() * 0.12;
  const baselineFootfallPer1000 = 3 + rand() * 4;

  for (let dayIndex = 0; dayIndex < HISTORY_DAYS; dayIndex++) {
    const date = addDays(START_DATE, dayIndex);
    const daysIntoOutbreak = differenceInCalendarDays(date, OUTBREAK_START);
    const outbreakSurge = isOutbreakDistrict ? outbreakMultiplier(daysIntoOutbreak, 1.8) : 1;

    const bedsOccupied = Math.min(
      phc.bedCapacity,
      Math.round(gaussianNoise(rand, phc.bedCapacity * baselineOccupancyRate * outbreakSurge, 1.2))
    );
    const attendanceDip = rand() < 0.05 ? randRangeInt(rand, 2, 5) : 0;
    const staffPresent = Math.max(
      0,
      Math.min(phc.staffSanctioned, Math.round(phc.staffSanctioned * baselineAttendanceRate) - attendanceDip)
    );
    const patientFootfall = Math.max(
      0,
      Math.round(
        gaussianNoise(
          rand,
          (phc.catchmentPopulation / 1000) * baselineFootfallPer1000 * 0.01 * outbreakSurge,
          3
        )
      )
    );

    facilityRows.push({
      id: `${phc.id}-${format(date, "yyyy-MM-dd")}`,
      phcId: phc.id,
      date: format(date, "yyyy-MM-dd"),
      bedsOccupied: Math.max(0, bedsOccupied),
      staffPresent,
      staffSanctioned: phc.staffSanctioned,
      patientFootfall,
    });
  }

  return { stockRows, facilityRows };
}

function randRangeInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function main() {
  const outDir = path.join(__dirname, "..", "data", "seed");
  mkdirSync(outDir, { recursive: true });

  const allStock: StockRow[] = [];
  const allFacility: FacilityRow[] = [];

  for (const phc of PHCS) {
    const { stockRows, facilityRows } = generateForPhc(phc);
    allStock.push(...stockRows);
    allFacility.push(...facilityRows);
  }

  writeFileSync(path.join(outDir, "districts.json"), JSON.stringify(DISTRICTS, null, 2));
  writeFileSync(path.join(outDir, "phcs.json"), JSON.stringify(PHCS, null, 2));
  writeFileSync(path.join(outDir, "stock-records.json"), JSON.stringify(allStock));
  writeFileSync(path.join(outDir, "facility-records.json"), JSON.stringify(allFacility));

  const stockCsvHeader = "id,phcId,date,sku,openingStock,received,consumed,closingStock,reorderLevel\n";
  const stockCsv =
    stockCsvHeader +
    allStock
      .map((r) => `${r.id},${r.phcId},${r.date},${r.sku},${r.openingStock},${r.received},${r.consumed},${r.closingStock},${r.reorderLevel}`)
      .join("\n");
  writeFileSync(path.join(outDir, "stock-records.csv"), stockCsv);

  const facilityCsvHeader = "id,phcId,date,bedsOccupied,staffPresent,staffSanctioned,patientFootfall\n";
  const facilityCsv =
    facilityCsvHeader +
    allFacility
      .map((r) => `${r.id},${r.phcId},${r.date},${r.bedsOccupied},${r.staffPresent},${r.staffSanctioned},${r.patientFootfall}`)
      .join("\n");
  writeFileSync(path.join(outDir, "facility-records.csv"), facilityCsv);

  console.log(`Generated ${PHCS.length} PHCs across ${DISTRICTS.length} districts.`);
  console.log(`Stock records: ${allStock.length}`);
  console.log(`Facility records: ${allFacility.length}`);
  console.log(`Outbreak window: ${format(OUTBREAK_START, "yyyy-MM-dd")} -> ${format(TODAY, "yyyy-MM-dd")}`);
  console.log(`Outbreak districts: ${OUTBREAK_DISTRICT_IDS.join(", ")}`);
  console.log(`Output written to ${outDir}`);
}

main();
