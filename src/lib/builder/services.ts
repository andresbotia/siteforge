import type { ServiceItem } from "./types";

const BY_INDUSTRY: Record<string, ServiceItem[]> = {
  Plumbing: [
    { name: "Repairs", summary: "Help with leaks, clogs, and fixture issues." },
    { name: "Maintenance", summary: "Routine care to keep plumbing working." },
    { name: "Installations", summary: "Replacement and new fixture work." },
  ],
  HVAC: [
    { name: "Cooling", summary: "Air conditioning service and repair." },
    { name: "Heating", summary: "Furnace and heat-pump support." },
    { name: "Maintenance", summary: "Seasonal system checkups." },
  ],
  Electrical: [
    { name: "Repairs", summary: "Electrical troubleshooting and fixes." },
    { name: "Upgrades", summary: "Panel and outlet upgrades where appropriate." },
    { name: "Installations", summary: "Lighting and fixture installation." },
  ],
  Roofing: [
    { name: "Repairs", summary: "Leak and damage repair." },
    { name: "Inspections", summary: "Roof condition checks." },
    { name: "Replacement", summary: "Reroof planning and installation." },
  ],
  Landscaping: [
    { name: "Maintenance", summary: "Lawn and landscape upkeep." },
    { name: "Design", summary: "Outdoor layout and planting plans." },
    { name: "Cleanup", summary: "Seasonal yard cleanup." },
  ],
  "Pest Control": [
    { name: "Inspection", summary: "Identify pest pressure around the property." },
    { name: "Treatment", summary: "Targeted treatment plans." },
    { name: "Prevention", summary: "Follow-up prevention guidance." },
  ],
  "Pool Services": [
    { name: "Cleaning", summary: "Routine pool care." },
    { name: "Repair", summary: "Equipment and surface repairs." },
    { name: "Maintenance", summary: "Ongoing pool upkeep." },
  ],
  "General Contractor": [
    { name: "Remodeling", summary: "Project planning and build-out." },
    { name: "Repairs", summary: "Home repair coordination." },
    { name: "Improvements", summary: "Targeted property upgrades." },
  ],
  "Pressure Washing": [
    { name: "House washing", summary: "Exterior cleaning for homes." },
    { name: "Driveways", summary: "Concrete and paver cleaning." },
    { name: "Commercial", summary: "Storefront and walkway cleaning." },
  ],
  "Auto Repair": [
    { name: "Diagnostics", summary: "Find the cause of the problem." },
    { name: "Maintenance", summary: "Oil, brakes, and routine service." },
    { name: "Repairs", summary: "Mechanical repair work." },
  ],
  Detailing: [
    { name: "Interior", summary: "Cabin cleaning and care." },
    { name: "Exterior", summary: "Wash and finish work." },
    { name: "Packages", summary: "Combined detail packages." },
  ],
  Salon: [
    { name: "Cuts", summary: "Haircuts and styling." },
    { name: "Color", summary: "Color services." },
    { name: "Care", summary: "Treatments and finishing." },
  ],
  Spa: [
    { name: "Wellness", summary: "Relaxation-focused visits." },
    { name: "Treatments", summary: "Spa treatment menu." },
    { name: "Appointments", summary: "Easy booking by phone or form." },
  ],
  Cleaning: [
    { name: "Home cleaning", summary: "Recurring or one-time house cleaning." },
    { name: "Deep cleaning", summary: "Thorough reset cleaning." },
    { name: "Move-in / move-out", summary: "Turnover cleaning." },
  ],
  "Professional Services": [
    { name: "Consultations", summary: "Talk through what you need." },
    { name: "Core services", summary: "The work this practice is set up to do." },
    { name: "Follow-up", summary: "Clear next steps after you reach out." },
  ],
  Dentistry: [
    { name: "Exams", summary: "Checkups and consultations." },
    { name: "Cleanings", summary: "Preventive dental care." },
    { name: "Treatments", summary: "Restorative work as needed." },
  ],
};

/**
 * Keyword aliases so real-world industry labels ("Air Conditioning & Heating")
 * reach the right capability list instead of silently falling back to generic
 * professional copy. Longest keyword wins. These describe what a trade of this
 * kind is generally set up to do; they never claim a specific business offers a
 * service, states a price, or holds a credential.
 */
const KEYWORD_ALIASES: Array<[keyword: string, industry: string]> = [
  ["air condition", "HVAC"],
  ["heating", "HVAC"],
  ["cooling", "HVAC"],
  ["hvac", "HVAC"],
  ["plumb", "Plumbing"],
  ["septic", "Plumbing"],
  ["drain", "Plumbing"],
  ["electric", "Electrical"],
  ["roof", "Roofing"],
  ["gutter", "Roofing"],
  ["landscap", "Landscaping"],
  ["lawn", "Landscaping"],
  ["tree service", "Landscaping"],
  ["irrigation", "Landscaping"],
  ["pest", "Pest Control"],
  ["pool", "Pool Services"],
  ["contractor", "General Contractor"],
  ["contracting", "General Contractor"],
  ["remodel", "General Contractor"],
  ["pressure wash", "Pressure Washing"],
  ["auto repair", "Auto Repair"],
  ["detail", "Detailing"],
  ["salon", "Salon"],
  ["barber", "Salon"],
  ["spa", "Spa"],
  ["clean", "Cleaning"],
  ["dental", "Dentistry"],
  ["dentist", "Dentistry"],
];

export function derivedServices(industry: string): ServiceItem[] {
  const exact = BY_INDUSTRY[industry];
  if (exact) return exact;

  const normalized = industry.trim().toLowerCase();
  let best: [string, string] | null = null;
  for (const entry of KEYWORD_ALIASES) {
    if (!normalized.includes(entry[0])) continue;
    if (!best || entry[0].length > best[0].length) best = entry;
  }
  if (best) return BY_INDUSTRY[best[1]];

  return BY_INDUSTRY["Professional Services"];
}
