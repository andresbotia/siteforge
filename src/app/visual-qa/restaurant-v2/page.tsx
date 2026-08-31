import { DraftSite } from "@/components/builder/site/draft-site";
import { restaurantModernV2FixtureSpec } from "@/lib/builder/restaurant-v2-fixture";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function RestaurantModernV2VisualQaPage() {
  return (
    <DraftSite
      spec={restaurantModernV2FixtureSpec}
      basePath="/visual-qa/restaurant-v2"
    />
  );
}
