import { SCOUT_DISCOVERY_COST_USD, SCOUT_PROVIDER_ID, SCOUT_PROVIDER_LABEL } from "./limits";
import type { DiscoveredBusiness, ScoutRunConfig } from "./types";

export type DiscoveryCost = {
  usd: number;
  paid: boolean;
  providerId: string;
  providerLabel: string;
  notes: string;
};

export type BusinessDiscoveryProvider = {
  id: string;
  label: string;
  cost: DiscoveryCost;
  search(config: ScoutRunConfig): Promise<DiscoveredBusiness[]>;
};

export const FREE_DISCOVERY_COST: DiscoveryCost = {
  usd: SCOUT_DISCOVERY_COST_USD,
  paid: false,
  providerId: SCOUT_PROVIDER_ID,
  providerLabel: SCOUT_PROVIDER_LABEL,
  notes: "No external business-data API. Paid AI is not required for basic qualification.",
};
