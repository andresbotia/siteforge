export const M95D_FIRST_CAMPAIGN_ID = "m9.5d-first-controlled-campaign";
export const M95D_FIRST_CAMPAIGN_MAX_PROSPECTS = 5;

export function canAddToM95DFirstCampaign(currentCount: number): boolean {
  return currentCount < M95D_FIRST_CAMPAIGN_MAX_PROSPECTS;
}

export function m95dCampaignCapacityMessage(currentCount: number): string {
  return canAddToM95DFirstCampaign(currentCount)
    ? `${currentCount}/${M95D_FIRST_CAMPAIGN_MAX_PROSPECTS} selected`
    : `M9.5D first campaign is capped at ${M95D_FIRST_CAMPAIGN_MAX_PROSPECTS} prospects.`;
}
