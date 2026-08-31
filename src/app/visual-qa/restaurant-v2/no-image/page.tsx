import { DraftSite } from "@/components/builder/site/draft-site";
import { restaurantModernV2FixtureSpec } from "@/lib/builder/restaurant-v2-fixture";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function RestaurantModernV2NoImageVisualQaPage() {
  return (
    <DraftSite
      spec={{
        ...restaurantModernV2FixtureSpec,
        assets: { images: [] },
      }}
      basePath="/visual-qa/restaurant-v2/no-image"
    />
  );
}
