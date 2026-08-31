import { notFound } from "next/navigation";
import { DraftSite } from "@/components/builder/site/draft-site";
import {
  VISUAL_QA_VARIANTS,
  isVisualQaVariant,
  visualQaSpec,
} from "@/lib/builder/visual-qa-fixtures";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export function generateStaticParams() {
  return VISUAL_QA_VARIANTS.map((variant) => ({ variant }));
}

export default async function LocalBusinessVisualQaPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isVisualQaVariant(variant)) notFound();
  return (
    <DraftSite
      spec={visualQaSpec(variant)}
      basePath={`/visual-qa/local-business/${variant}`}
    />
  );
}
