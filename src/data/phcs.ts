import type { PHC } from "@/types/domain";
import { DISTRICTS } from "./geography";
import { mulberry32, hashStringToSeed, randInt, randRange, choice } from "@/lib/rng";

const PHCS_PER_DISTRICT = 5;

/** State-appropriate block/village name components for realistic (synthetic) PHC naming. */
const NAME_PARTS: Record<string, { prefixes: string[]; suffixes: string[] }> = {
  Maharashtra: {
    prefixes: ["Shiv", "Ram", "Bhosale", "Kranti", "Jai", "Sant", "Ganesh", "Vithal"],
    suffixes: ["wadi", "gaon", "nagar", "pur", "khed"],
  },
  "Uttar Pradesh": {
    prefixes: ["Ram", "Krishna", "Bhola", "Gandhi", "Shastri", "Lal", "Ganga", "Ravi"],
    suffixes: ["pur", "ganj", "nagar", "abad", "kheda"],
  },
  Karnataka: {
    prefixes: ["Basava", "Hanuma", "Chikka", "Bele", "Sri", "Krishna", "Anand", "Vijaya"],
    suffixes: ["halli", "pura", "nagara", "pete", "kere"],
  },
  Bihar: {
    prefixes: ["Ram", "Bhim", "Jai", "Ganga", "Kishun", "Ravi", "Shiv", "Baba"],
    suffixes: ["pur", "ganj", "bigha", "tola", "nagar"],
  },
  Rajasthan: {
    prefixes: ["Bala", "Ram", "Surya", "Jai", "Amar", "Rana", "Megh", "Padma"],
    suffixes: ["garh", "pura", "sar", "nagar", "wali"],
  },
};

function generatePhcsForDistrict(districtId: string): PHC[] {
  const district = DISTRICTS.find((d) => d.id === districtId)!;
  const rand = mulberry32(hashStringToSeed(districtId));
  const parts = NAME_PARTS[district.state];

  const phcs: PHC[] = [];
  for (let i = 0; i < PHCS_PER_DISTRICT; i++) {
    const villageName = `${choice(rand, parts.prefixes)}${choice(rand, parts.suffixes)}`;
    // Offset ~5-25km from district HQ so PHCs spread across the district for the map view.
    const angle = randRange(rand, 0, 2 * Math.PI);
    const distanceDeg = randRange(rand, 0.05, 0.22);
    phcs.push({
      id: `${districtId}-phc-${i + 1}`,
      name: `PHC ${villageName}`,
      districtId,
      state: district.state,
      block: villageName,
      lat: Number((district.lat + distanceDeg * Math.cos(angle)).toFixed(5)),
      lng: Number((district.lng + distanceDeg * Math.sin(angle)).toFixed(5)),
      bedCapacity: randInt(rand, 6, 30),
      staffSanctioned: randInt(rand, 8, 25),
      catchmentPopulation: randInt(rand, 15000, 60000),
    });
  }
  return phcs;
}

export const PHCS: PHC[] = DISTRICTS.flatMap((d) => generatePhcsForDistrict(d.id));
