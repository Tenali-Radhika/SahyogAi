import type { District, IndianState } from "@/types/domain";

/**
 * Curated real district headquarters across 5 states, spanning India's
 * north/south/east/west so the demo reads as genuinely national, not a
 * single-region pilot. Coordinates are the district HQ town; individual PHCs
 * are generated with a small offset around each district (see phcs.ts).
 *
 * PHC-level facility data is not published in a granular, machine-readable
 * form on data.gov.in, so operational data (stock/beds/staffing/footfall) is
 * synthetic — seeded to reproduce realistic seasonal patterns and a scripted
 * monsoon outbreak. District geography and state boundaries are real.
 */
export const DISTRICTS: District[] = [
  { id: "mh-pune", name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { id: "mh-nashik", name: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898 },
  { id: "mh-nagpur", name: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { id: "mh-solapur", name: "Solapur", state: "Maharashtra", lat: 17.6599, lng: 75.9064 },

  { id: "up-lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { id: "up-varanasi", name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739 },
  { id: "up-agra", name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
  { id: "up-gorakhpur", name: "Gorakhpur", state: "Uttar Pradesh", lat: 26.7606, lng: 83.3732 },

  { id: "ka-bengaluru-rural", name: "Bengaluru Rural", state: "Karnataka", lat: 13.2846, lng: 77.6006 },
  { id: "ka-mysuru", name: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { id: "ka-belagavi", name: "Belagavi", state: "Karnataka", lat: 15.8497, lng: 74.4977 },
  { id: "ka-kalaburagi", name: "Kalaburagi", state: "Karnataka", lat: 17.3297, lng: 76.8343 },

  { id: "br-patna", name: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  { id: "br-gaya", name: "Gaya", state: "Bihar", lat: 24.7955, lng: 85.0002 },
  { id: "br-muzaffarpur", name: "Muzaffarpur", state: "Bihar", lat: 26.1225, lng: 85.3906 },
  { id: "br-purnia", name: "Purnia", state: "Bihar", lat: 25.7771, lng: 87.4753 },

  { id: "rj-jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { id: "rj-jodhpur", name: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243 },
  { id: "rj-udaipur", name: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125 },
  { id: "rj-bikaner", name: "Bikaner", state: "Rajasthan", lat: 28.0229, lng: 73.3119 },
];

export const STATES: IndianState[] = [
  "Maharashtra",
  "Uttar Pradesh",
  "Karnataka",
  "Bihar",
  "Rajasthan",
];

/** Districts scripted into an active monsoon waterborne-disease outbreak for the demo. */
export const OUTBREAK_DISTRICT_IDS = ["up-gorakhpur", "br-purnia"];
