import { SCOUT_DISCOVERY_COST_USD, SCOUT_PROVIDER_ID, SCOUT_PROVIDER_LABEL } from "./limits";
import type { DiscoveredBusiness, ScoutRunConfig } from "./types";

export type DiscoveryCost = {
  usd: number;
  paid: boolean;
  providerId: string;
  providerLabel: string;
  notes: string;
};

/**
 * `diagnostic` carries a human-readable, non-throwing explanation for a
 * partial or empty result (unsupported location, no category tag mapping,
 * upstream rate limit, network error, or simply zero real matches) so the
 * operator sees why a run returned little/nothing instead of it looking
 * silently broken. `null` diagnostic with an empty array just means a real,
 * clean zero-result search.
 */
export type DiscoveryResult = {
  businesses: DiscoveredBusiness[];
  diagnostic: string | null;
};

export type BusinessDiscoveryProvider = {
  id: string;
  label: string;
  cost: DiscoveryCost;
  search(config: ScoutRunConfig): Promise<DiscoveryResult>;
};

export const FREE_DISCOVERY_COST: DiscoveryCost = {
  usd: SCOUT_DISCOVERY_COST_USD,
  paid: false,
  providerId: SCOUT_PROVIDER_ID,
  providerLabel: SCOUT_PROVIDER_LABEL,
  notes: "No external business-data API. Paid AI is not required for basic qualification.",
};
