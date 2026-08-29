import type { ScoutCategoryId } from "./categories";
import { FREE_DISCOVERY_COST, type BusinessDiscoveryProvider } from "./discovery";
import { createMockHttpClient, type ScoutHttpClient } from "./inspector";
import { locationMatches, parseLocation } from "./normalize";
import type { DiscoveredBusiness, ScoutRunConfig } from "./types";

type CatalogRecord = DiscoveredBusiness;

const CATALOG: CatalogRecord[] = [
  {
    name: "Atlantic Drain Plumbing",
    categoryId: "plumbers",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    address: "910 NE 3rd Avenue",
    websiteUrl: "https://atlanticdrain.example.test",
    phone: "(954) 555-0401",
    rating: 4.8,
    reviewCount: 210,
    source: "mock_catalog",
  },
  {
    name: "Harborline Plumbing",
    categoryId: "plumbers",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    address: "1842 SE 17th Street",
    websiteUrl: "https://www.harborlineplumbing.example.test",
    phone: "(954) 555-0142",
    rating: 4.8,
    reviewCount: 312,
    source: "mock_catalog",
  },
  {
    name: "Tiny Leak Bros",
    categoryId: "plumbers",
    industry: "Plumbing",
    city: "Fort Lauderdale",
    state: "FL",
    websiteUrl: "https://tinyleak.example.test",
    phone: "(954) 555-0408",
    rating: 3.4,
    reviewCount: 6,
    source: "mock_catalog",
  },
  {
    name: "McDonald's",
    categoryId: "restaurants",
    industry: "Restaurant",
    city: "Fort Lauderdale",
    state: "FL",
    websiteUrl: "https://mcdonalds.example.test",
    rating: 3.9,
    reviewCount: 2400,
    source: "mock_catalog",
    likelyChain: true,
  },
  {
    name: "Mangrove Table",
    categoryId: "restaurants",
    industry: "Restaurant",
    city: "Fort Lauderdale",
    state: "FL",
    websiteUrl: "https://mangrovetable.example.test",
    phone: "(954) 555-0444",
    rating: 4.7,
    reviewCount: 188,
    source: "mock_catalog",
  },
  {
    name: "Breeze Oven Cafe",
    categoryId: "cafes",
    industry: "Cafe",
    city: "Boca Raton",
    state: "FL",
    websiteUrl: "https://breezeoven.example.test",
    rating: 4.6,
    reviewCount: 92,
    source: "mock_catalog",
  },
  {
    name: "Palm Court Bakery",
    categoryId: "bakeries",
    industry: "Bakery",
    city: "Pompano Beach",
    state: "FL",
    websiteUrl: "https://palmcourt.bakery.example.test",
    rating: 4.5,
    reviewCount: 74,
    source: "mock_catalog",
  },
  {
    name: "Cypress Coil HVAC",
    categoryId: "hvac",
    industry: "HVAC",
    city: "Coconut Creek",
    state: "FL",
    websiteUrl: "https://cypresscoil.example.test",
    rating: 4.6,
    reviewCount: 121,
    source: "mock_catalog",
  },
  {
    name: "Sawgrass Spark Electric",
    categoryId: "electricians",
    industry: "Electrical",
    city: "Coral Springs",
    state: "FL",
    websiteUrl: "https://sawgrassspark.example.test",
    rating: 4.4,
    reviewCount: 58,
    source: "mock_catalog",
  },
  {
    name: "Ridge Line Roofing",
    categoryId: "roofers",
    industry: "Roofing",
    city: "Pompano Beach",
    state: "FL",
    websiteUrl: null,
    rating: 4.9,
    reviewCount: 340,
    source: "mock_catalog",
  },
  {
    name: "Oak & Frond Landscaping",
    categoryId: "landscapers",
    industry: "Landscaping",
    city: "Boca Raton",
    state: "FL",
    websiteUrl: "https://oakandfrond.example.test",
    rating: 4.7,
    reviewCount: 80,
    source: "mock_catalog",
  },
  {
    name: "Bayshore Auto Repair",
    categoryId: "auto_repair",
    industry: "Auto Repair",
    city: "Fort Lauderdale",
    state: "FL",
    websiteUrl: "https://bayshoreauto.example.test",
    rating: 4.8,
    reviewCount: 156,
    source: "mock_catalog",
  },
  {
    name: "Salt Air Salon",
    categoryId: "salons",
    industry: "Salon",
    city: "Fort Lauderdale",
    state: "FL",
    websiteUrl: "https://saltairsalon.example.test",
    rating: 4.5,
    reviewCount: 64,
    source: "mock_catalog",
  },
  {
    name: "Quiet Tide Spa",
    categoryId: "spas",
    industry: "Spa",
    city: "Boca Raton",
    state: "FL",
    websiteUrl: "https://quiettidespa.example.test",
    rating: 4.3,
    reviewCount: 41,
    source: "mock_catalog",
  },
  {
    name: "Lantern Pest Control",
    categoryId: "pest_control",
    industry: "Pest Control",
    city: "Coconut Creek",
    state: "FL",
    websiteUrl: "https://lanternpest.example.test",
    rating: 4.6,
    reviewCount: 99,
    source: "mock_catalog",
  },
];

const BAD_SITE = `<!doctype html><html><head><title></title></head><body><p>Welcome</p><a href="/menu.pdf">Menu PDF</a></body></html>`;
const NO_VIEWPORT = `<!doctype html><html><head><title>Local Shop</title><meta name="description" content="We fix things"></head><body><h1>Hello</h1><nav><a href="/">Home</a></nav><a href="tel:9545550000">Call</a></body></html>`;
const BROKEN_MENU = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Mangrove Table</title></head><body><h1>Mangrove Table</h1><nav>Nav</nav><p>Dinner menu and reservations.</p><a href="/menu">Menu</a><a href="/reserve">Reserve a table</a><form></form></body></html>`;
const STRONG_BAD = `<!doctype html><html><head><title>Atlantic Drain</title></head><body><div>Plumbing</div><a href="http://atlanticdrain.example.test/quote">Get a quote</a></body></html>`;

export const CATALOG_HTTP_FIXTURES: Record<string, { status?: number; body?: string; location?: string | null }> =
  {
    "https://atlanticdrain.example.test": { body: STRONG_BAD },
    "https://tinyleak.example.test": { body: BAD_SITE },
    "https://mangrovetable.example.test": { body: BROKEN_MENU },
    "https://mangrovetable.example.test/menu": { status: 404, body: "missing" },
    "https://mangrovetable.example.test/reserve": { status: 404, body: "missing" },
    "https://breezeoven.example.test": { body: NO_VIEWPORT },
    "https://www.harborlineplumbing.example.test": { body: NO_VIEWPORT },
    "https://cypresscoil.example.test": { body: STRONG_BAD },
    "https://bayshoreauto.example.test": { body: BAD_SITE },
    "https://oakandfrond.example.test": { body: NO_VIEWPORT },
    "https://lanternpest.example.test": { body: STRONG_BAD },
    "https://sawgrassspark.example.test": { body: NO_VIEWPORT },
    "https://palmcourt.bakery.example.test": { body: BROKEN_MENU },
    "https://palmcourt.bakery.example.test/menu": { status: 200, body: "<html><title>PDF</title></html>" },
    "https://saltairsalon.example.test": { body: NO_VIEWPORT },
    "https://quiettidespa.example.test": { body: NO_VIEWPORT },
    "https://mcdonalds.example.test": {
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>McDonald's</title><meta name="description" content="Burgers"></head><body><nav></nav><h1>McDonald's</h1><h2>Menu</h2><a href="/menu">Menu</a><form></form></body></html>`,
    },
  };

export function createMockCatalogProvider(
  records: CatalogRecord[] = CATALOG,
): BusinessDiscoveryProvider {
  return {
    id: FREE_DISCOVERY_COST.providerId,
    label: FREE_DISCOVERY_COST.providerLabel,
    cost: FREE_DISCOVERY_COST,
    async search(config: ScoutRunConfig) {
      const location = parseLocation(config.location);
      const matches = records.filter((item) => {
        if (item.categoryId !== config.categoryId) return false;
        return locationMatches(item.city, item.state, location);
      });
      return matches.slice(0, config.limit);
    },
  };
}

export function catalogByCategory(id: ScoutCategoryId): CatalogRecord[] {
  return CATALOG.filter((item) => item.categoryId === id);
}

export function createCatalogHttpClient(): ScoutHttpClient {
  return createMockHttpClient(CATALOG_HTTP_FIXTURES);
}
