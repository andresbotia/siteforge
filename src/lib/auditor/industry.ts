const RESTAURANT_INDUSTRIES = new Set([
  "Restaurant",
  "Cafe",
  "Bakery",
  "Casual Dining",
]);

const HOME_SERVICE_INDUSTRIES = new Set([
  "Plumbing",
  "HVAC",
  "Roofing",
  "Landscaping",
  "Electrical",
  "Pest Control",
  "Pool Services",
  "General Contractor",
  "Pressure Washing",
]);

export function isRestaurantIndustry(industry: string): boolean {
  return RESTAURANT_INDUSTRIES.has(industry);
}

export function isHomeServiceIndustry(industry: string): boolean {
  return HOME_SERVICE_INDUSTRIES.has(industry);
}
