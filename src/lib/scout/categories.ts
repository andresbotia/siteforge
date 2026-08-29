export const SCOUT_CATEGORY_GROUPS = [
  "home_services",
  "professional_local",
  "restaurants",
] as const;

export type ScoutCategoryGroup = (typeof SCOUT_CATEGORY_GROUPS)[number];

export type ScoutCategoryId =
  | "plumbers"
  | "hvac"
  | "electricians"
  | "roofers"
  | "landscapers"
  | "pest_control"
  | "pool_services"
  | "general_contractors"
  | "auto_repair"
  | "detailing"
  | "salons"
  | "spas"
  | "cleaning"
  | "professional_services"
  | "restaurants"
  | "cafes"
  | "bakeries"
  | "casual_dining";

export type ScoutCategory = {
  id: ScoutCategoryId;
  label: string;
  industry: string;
  group: ScoutCategoryGroup;
  restaurant: boolean;
};

export const SCOUT_CATEGORIES: ScoutCategory[] = [
  { id: "plumbers", label: "Plumbers", industry: "Plumbing", group: "home_services", restaurant: false },
  { id: "hvac", label: "HVAC", industry: "HVAC", group: "home_services", restaurant: false },
  { id: "electricians", label: "Electricians", industry: "Electrical", group: "home_services", restaurant: false },
  { id: "roofers", label: "Roofers", industry: "Roofing", group: "home_services", restaurant: false },
  { id: "landscapers", label: "Landscapers", industry: "Landscaping", group: "home_services", restaurant: false },
  { id: "pest_control", label: "Pest control", industry: "Pest Control", group: "home_services", restaurant: false },
  { id: "pool_services", label: "Pool services", industry: "Pool Services", group: "home_services", restaurant: false },
  {
    id: "general_contractors",
    label: "General contractors",
    industry: "General Contractor",
    group: "home_services",
    restaurant: false,
  },
  { id: "auto_repair", label: "Auto repair", industry: "Auto Repair", group: "professional_local", restaurant: false },
  { id: "detailing", label: "Detailing", industry: "Detailing", group: "professional_local", restaurant: false },
  { id: "salons", label: "Salons / barbers", industry: "Salon", group: "professional_local", restaurant: false },
  { id: "spas", label: "Spas", industry: "Spa", group: "professional_local", restaurant: false },
  { id: "cleaning", label: "Cleaning services", industry: "Cleaning", group: "professional_local", restaurant: false },
  {
    id: "professional_services",
    label: "Small professional services",
    industry: "Professional Services",
    group: "professional_local",
    restaurant: false,
  },
  { id: "restaurants", label: "Independent restaurants", industry: "Restaurant", group: "restaurants", restaurant: true },
  { id: "cafes", label: "Cafes", industry: "Cafe", group: "restaurants", restaurant: true },
  { id: "bakeries", label: "Bakeries", industry: "Bakery", group: "restaurants", restaurant: true },
  { id: "casual_dining", label: "Casual dining", industry: "Casual Dining", group: "restaurants", restaurant: true },
];

export function getScoutCategory(id: string): ScoutCategory | undefined {
  return SCOUT_CATEGORIES.find((item) => item.id === id);
}

export function isRestaurantCategory(id: string): boolean {
  return getScoutCategory(id)?.restaurant === true;
}
