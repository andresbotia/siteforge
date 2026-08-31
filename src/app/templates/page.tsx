import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { DesignBriefForm } from "@/components/builder/design-brief-form";
import { DESIGN_PRESETS } from "@/lib/builder/design-system";
import { ACTIVE_TEMPLATES } from "@/lib/builder/registry";
import { VISUAL_QA_LABELS, VISUAL_QA_VARIANTS } from "@/lib/builder/visual-qa-fixtures";

export const metadata: Metadata = {
  title: "Templates | SiteForge",
};

export default function TemplateLibraryPage() {
  return (
    <>
      <PageHeader
        title="Template library"
        description="Master templates Builder can instantiate for a prospect. Selection is deterministic keyword matching; no paid AI is involved."
      />

      <div className="space-y-4">
        {ACTIVE_TEMPLATES.map((definition) => {
          const preset = DESIGN_PRESETS[definition.designPreset];
          return (
            <Card key={definition.key}>
              <CardHeader
                title={definition.label}
                description={definition.summary}
                action={<Badge tone="success">{definition.id}</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Renderer" value={definition.renderer} />
                  <Field label="Design preset" value={`${preset.label} (${preset.heroTreatment}, ${preset.density})`} />
                  <Field label="Required facts" value={definition.requiredFacts.join(", ")} />
                  <Field label="Image roles" value={definition.imageRoles.join(", ")} />
                  <Field label="CTA capabilities" value={definition.ctaCapabilities.join(", ")} />
                  <Field label="Template artwork" value={`public/fixtures/${definition.imageFamily}/`} />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Palette</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["surface", preset.surface],
                      ["ink", preset.ink],
                      ["deep", preset.deep],
                      ["accent", preset.accent],
                      ["band", preset.band],
                      ["highlight", preset.highlight],
                    ].map(([label, color]) => (
                      <span key={label} className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                        <span
                          className="inline-block size-4 rounded-sm border border-border"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        {label} {color}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Industry keywords</p>
                  <p className="text-sm text-muted">{definition.industryKeywords.join(" · ")}</p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Visual QA"
          description="Rendered from real Builder pipeline output on fictional QA businesses, including sparse-fact cases. Admin-only and noindex."
        />
        <CardBody>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/visual-qa/restaurant-v2" className="text-accent hover:underline">
                Restaurant Modern - full facts
              </Link>
            </li>
            <li>
              <Link href="/visual-qa/restaurant-v2/no-image" className="text-accent hover:underline">
                Restaurant Modern - no approved imagery
              </Link>
            </li>
            {VISUAL_QA_VARIANTS.map((variant) => (
              <li key={variant}>
                <Link href={`/visual-qa/local-business/${variant}`} className="text-accent hover:underline">
                  {VISUAL_QA_LABELS[variant]}
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <DesignBriefForm />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}
