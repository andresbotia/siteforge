import { PALETTE_STYLES } from "@/lib/builder/palettes";
import type { PageId } from "@/lib/builder/limits";
import { isPageId } from "@/lib/builder/validate";
import { validateWebsiteSpec } from "@/lib/builder/validate";
import type { Section, SiteCta, SpecPage, WebsiteSpec } from "@/lib/builder/types";
import { TrackedCtaLink } from "@/components/builder/site/tracked-cta-link";
import type { PreviewEventType } from "@/types";

export function DraftSite({
  spec,
  pageId = "home",
  basePath,
  trackingToken,
}: {
  spec: unknown;
  pageId?: string;
  basePath: string;
  trackingToken?: string;
}) {
  const validated = validateWebsiteSpec(spec);
  if (!validated.ok) {
    return (
      <div className="p-8 text-sm text-red-800">
        This draft cannot be rendered ({validated.error}).
      </div>
    );
  }
  const website = validated.spec;
  const current: PageId = isPageId(pageId) ? pageId : "home";
  const page = website.pages.find((item) => item.id === current) ?? website.pages[0];
  const theme = PALETTE_STYLES[website.palette];

  return (
    <div className={`sf-draft min-h-full ${theme.wrap}`} style={{ colorScheme: "light" }}>
      {page.sections.map((section, index) => (
        <SectionView
          key={`${section.type}-${index}`}
          section={section}
          page={page}
          spec={website}
          theme={theme}
          basePath={basePath}
          current={current}
          trackingToken={trackingToken}
        />
      ))}
    </div>
  );
}

function SectionView({
  section,
  spec,
  theme,
  basePath,
  current,
  trackingToken,
}: {
  section: Section;
  page: SpecPage;
  spec: WebsiteSpec;
  theme: (typeof PALETTE_STYLES)[keyof typeof PALETTE_STYLES];
  basePath: string;
  current: PageId;
  trackingToken?: string;
}) {
  switch (section.type) {
    case "announcement":
      return (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-slate-950">
          {section.text}
        </div>
      );
    case "header":
      return (
        <header className={theme.header}>
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-lg font-semibold tracking-tight">{section.businessName}</p>
            <nav aria-label="Primary" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {spec.navigation.map((item) => (
                <a
                  key={item.id}
                  href={`${basePath}?page=${item.id}`}
                  className={`underline-offset-4 hover:underline ${current === item.id ? "font-semibold" : "opacity-90"}`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              {section.ctas.map((cta) => (
                <CtaLink key={`${cta.kind}-${cta.label}`} cta={cta} className={theme.accent} basePath={basePath} trackingToken={trackingToken} />
              ))}
            </div>
          </div>
        </header>
      );
    case "hero":
      return (
        <section className={`${theme.hero} px-4 py-16 md:py-24`}>
          <div className="mx-auto max-w-5xl">
            {section.eyebrow ? (
              <p className="text-sm tracking-wide uppercase opacity-80">{section.eyebrow}</p>
            ) : null}
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
              {section.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-lg opacity-90">{section.lede}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {section.ctas.map((cta) => (
                <CtaLink key={`${cta.kind}-${cta.label}`} cta={cta} className={theme.accent} basePath={basePath} trackingToken={trackingToken} />
              ))}
            </div>
            <div className="mt-12 h-24 rounded-2xl bg-white/10" aria-hidden="true" />
          </div>
        </section>
      );
    case "trust":
      return (
        <section className={`${theme.band} px-4 py-6`}>
          <div className="mx-auto flex max-w-5xl flex-wrap gap-6 text-sm">
            {section.rating ? <p>Public rating {section.rating.toFixed(1)}</p> : null}
            {section.reviewCount ? <p>{section.reviewCount} public reviews</p> : null}
            {section.note ? <p>{section.note}</p> : null}
          </div>
        </section>
      );
    case "services":
      return (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-3xl font-semibold tracking-tight">{section.heading}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {section.items.map((item) => (
              <article key={item.name} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-medium">{item.name}</h3>
                <p className={`mt-2 text-sm ${theme.muted}`}>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      );
    case "about":
    case "serviceArea":
      return (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-3xl font-semibold tracking-tight">{section.heading}</h2>
          <p className={`mt-4 max-w-3xl text-lg ${theme.muted}`}>{section.body}</p>
        </section>
      );
    case "menuPreview":
      return (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-3xl font-semibold tracking-tight">{section.heading}</h2>
          <p className={`mt-4 max-w-3xl text-lg ${theme.muted}`}>{section.body}</p>
          {section.href && section.label ? (
            <a href={section.href} className={`mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-medium ${theme.accent}`}>
              {section.label}
            </a>
          ) : null}
        </section>
      );
    case "hoursLocation":
      return (
        <section className={`${theme.band} px-4 py-12`}>
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold">{section.heading}</h2>
            {section.location ? <p className="mt-3 text-lg">{section.location}</p> : null}
            {section.hours ? <p className="mt-2">{section.hours}</p> : null}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-3xl font-semibold">{section.heading}</h2>
            <p className={`mt-3 ${theme.muted}`}>{section.body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {section.ctas.map((cta) => (
                <CtaLink key={`${cta.kind}-${cta.label}`} cta={cta} className={theme.accent} basePath={basePath} trackingToken={trackingToken} />
              ))}
            </div>
          </div>
        </section>
      );
    case "contact":
      return (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-3xl font-semibold">{section.heading}</h2>
          <ul className="mt-6 space-y-2 text-lg">
            {section.phone ? (
              <li>
                <a className="underline" href={`tel:${section.phone.replace(/[^\d+]/g, "")}`}>
                  {section.phone}
                </a>
              </li>
            ) : null}
            {section.email ? (
              <li>
                <a className="underline" href={`mailto:${section.email}`}>
                  {section.email}
                </a>
              </li>
            ) : null}
            {section.location ? <li>{section.location}</li> : null}
          </ul>
        </section>
      );
    case "footer":
      return (
        <footer className={`${theme.footer} px-4 py-8`}>
          <div className="mx-auto max-w-5xl text-sm opacity-80">
            <p>{section.businessName}</p>
            <p className="mt-2">{section.note}</p>
          </div>
        </footer>
      );
    default:
      return null;
  }
}

function CtaLink({
  cta,
  className,
  basePath,
  trackingToken,
}: {
  cta: SiteCta;
  className: string;
  basePath: string;
  trackingToken?: string;
}) {
  const href = resolveDraftHref(cta.href, basePath);
  const linkClass = `inline-flex rounded-full px-4 py-2 text-sm font-medium ${className}`;
  if (trackingToken) {
    return (
      <TrackedCtaLink
        href={href}
        label={cta.label}
        className={linkClass}
        token={trackingToken}
        eventType={previewEventForCta(cta)}
      />
    );
  }
  return (
    <a
      href={href}
      className={linkClass}
    >
      {cta.label}
    </a>
  );
}

function previewEventForCta(cta: SiteCta): PreviewEventType {
  if (cta.kind === "phone" || cta.href.startsWith("tel:")) return "phone_cta_clicked";
  if (cta.kind === "contact" || cta.href.startsWith("mailto:")) return "contact_cta_clicked";
  return "cta_clicked";
}

function resolveDraftHref(href: string, basePath: string): string {
  if (href === "/" ) return `${basePath}?page=home`;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes(".")) {
    return `${basePath}?page=${href.slice(1) || "home"}`;
  }
  return href;
}
