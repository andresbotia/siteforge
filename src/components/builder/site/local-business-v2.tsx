import Image from "next/image";
import { Clock, MapPin, Phone } from "lucide-react";
import type { PageId } from "@/lib/builder/limits";
import type { DesignPreset } from "@/lib/builder/design-system";
import { presetCssVariables } from "@/lib/builder/design-system";
import type { TemplateDefinition } from "@/lib/builder/registry";
import type {
  Section,
  ServiceItem,
  SiteCta,
  SpecPage,
  WebsiteImageAsset,
  WebsiteSpec,
} from "@/lib/builder/types";
import type { PreviewEventType } from "@/types";
import { TrackedCtaLink } from "./tracked-cta-link";

/**
 * Shared section system for non-restaurant templates.
 *
 * One layout engine, many looks: composition and rhythm are fixed here, while
 * color, type, radius, density, and hero treatment come from the design preset.
 * Sections render only from facts present on the spec; nothing is invented to
 * fill a slot, and any section without sourced content is omitted entirely.
 */

type LocalBusinessV2SiteProps = {
  spec: WebsiteSpec;
  page: SpecPage;
  pageId: PageId;
  preset: DesignPreset;
  definition: TemplateDefinition;
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
};

type Tracking = {
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
};

export function LocalBusinessV2Site({
  spec,
  page,
  pageId,
  preset,
  definition,
  basePath,
  trackingToken,
  outreachTrackingToken,
}: LocalBusinessV2SiteProps) {
  const tracking: Tracking = { basePath, trackingToken, outreachTrackingToken };
  const images = spec.assets?.images ?? [];
  const heroImage = images.find((image) => image.role === "hero") ?? null;
  const announcement = page.sections.find((section) => section.type === "announcement");
  const header = page.sections.find((section) => section.type === "header");
  const hero = page.sections.find((section) => section.type === "hero");
  const body = page.sections.filter(
    (section) =>
      section.type !== "announcement" &&
      section.type !== "header" &&
      section.type !== "hero" &&
      section.type !== "footer",
  );
  const footer = page.sections.find((section) => section.type === "footer");

  return (
    <div
      className="sf-local-v2 min-h-full overflow-x-hidden bg-[var(--sf-surface)] text-[var(--sf-ink)]"
      style={{ ...presetCssVariables(preset), colorScheme: "light", fontFamily: "var(--sf-body-font)" }}
    >
      {announcement?.type === "announcement" ? (
        <AnnouncementBar text={announcement.text} phone={spec.business.phone} tracking={tracking} />
      ) : null}
      {header?.type === "header" ? (
        <SiteHeader section={header} spec={spec} pageId={pageId} tracking={tracking} />
      ) : null}
      {hero?.type === "hero" ? (
        <Hero
          section={hero}
          spec={spec}
          preset={preset}
          heroImage={heroImage}
          tracking={tracking}
        />
      ) : null}
      {body.map((section, index) => (
        <BodySection
          key={`${section.type}-${index}`}
          section={section}
          spec={spec}
          definition={definition}
          index={index}
          tracking={tracking}
        />
      ))}
      {footer?.type === "footer" ? <SiteFooter section={footer} spec={spec} /> : null}
    </div>
  );
}

function AnnouncementBar({
  text,
  phone,
  tracking,
}: {
  text: string;
  phone: string | null;
  tracking: Tracking;
}) {
  return (
    <div className="bg-[var(--sf-accent)] px-4 py-2.5 text-[var(--sf-accent-ink)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm font-medium">
        <span>{text}</span>
        {phone ? (
          <TrackedAnchor
            href={telHref(phone)}
            label={phone}
            eventType="phone_cta_clicked"
            className="font-semibold underline underline-offset-4"
            tracking={tracking}
          />
        ) : null}
      </div>
    </div>
  );
}

function SiteHeader({
  section,
  spec,
  pageId,
  tracking,
}: {
  section: Extract<Section, { type: "header" }>;
  spec: WebsiteSpec;
  pageId: PageId;
  tracking: Tracking;
}) {
  const primary = section.ctas[0] ?? null;
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--sf-hairline)] bg-[color-mix(in_srgb,var(--sf-surface)_92%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
        <a
          href={`${tracking.basePath}?page=home`}
          className="min-w-0 truncate text-base font-semibold tracking-tight text-[var(--sf-ink)]"
          style={{ fontFamily: "var(--sf-display-font)" }}
        >
          {spec.business.shortName ?? section.businessName}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
          {spec.navigation.map((item) => (
            <a
              key={item.id}
              href={`${tracking.basePath}?page=${item.id}`}
              className={
                pageId === item.id
                  ? "font-semibold text-[var(--sf-ink)]"
                  : "text-[var(--sf-ink-muted)] underline-offset-4 hover:text-[var(--sf-ink)] hover:underline"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {section.phone ? (
            <TrackedAnchor
              href={telHref(section.phone)}
              label={section.phone}
              eventType="phone_cta_clicked"
              className="hidden text-sm font-semibold text-[var(--sf-ink)] underline-offset-4 hover:underline lg:inline"
              tracking={tracking}
            />
          ) : null}
          {primary ? <CtaButton cta={primary} variant="solid" tracking={tracking} /> : null}
        </div>
      </div>
    </header>
  );
}

function Hero({
  section,
  spec,
  preset,
  heroImage,
  tracking,
}: {
  section: Extract<Section, { type: "hero" }>;
  spec: WebsiteSpec;
  preset: DesignPreset;
  heroImage: WebsiteImageAsset | null;
  tracking: Tracking;
}) {
  const editorial = preset.heroTreatment !== "image-overlay" && !heroImage;
  return (
    <section className="relative isolate overflow-hidden bg-[var(--sf-deep)] text-[var(--sf-deep-ink)]">
      {heroImage ? (
        <Image
          src={heroImage.url}
          alt={heroImage.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-45"
          unoptimized
        />
      ) : (
        <div className="sf-hero-canvas absolute inset-0" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--sf-deep)] via-[color-mix(in_srgb,var(--sf-deep)_80%,transparent)] to-[color-mix(in_srgb,var(--sf-deep)_30%,transparent)]" />
      <div
        className={`relative mx-auto grid w-full max-w-6xl content-end gap-10 px-4 pb-14 pt-24 md:items-end md:pb-20 ${
          editorial ? "md:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)]" : "md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
        }`}
        style={{ minHeight: editorial ? "62vh" : "72vh" }}
      >
        <div className="sf-fade-up min-w-0">
          {section.eyebrow ? (
            <p className="break-words text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-highlight)] sm:text-sm">
              {section.eyebrow}
            </p>
          ) : null}
          <h1
            className="mt-4 max-w-[calc(100vw-2rem)] break-words text-4xl font-semibold leading-[1.05] sm:text-5xl md:max-w-3xl md:text-6xl"
            style={{ fontFamily: "var(--sf-display-font)" }}
          >
            {section.headline}
          </h1>
          <p className="mt-5 max-w-[calc(100vw-2rem)] break-words text-lg leading-8 text-[var(--sf-deep-ink-muted)] md:max-w-2xl md:text-xl">
            {section.lede}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {section.ctas.map((cta, index) => (
              <CtaButton
                key={`${cta.kind}-${cta.href}`}
                cta={cta}
                variant={index === 0 ? "solid" : "light"}
                size="lg"
                tracking={tracking}
              />
            ))}
          </div>
        </div>
        <HeroProof spec={spec} />
      </div>
    </section>
  );
}

/**
 * Credibility panel beside the hero. Renders only sourced reputation and
 * contact facts; when nothing is sourced the column collapses rather than
 * showing a placeholder.
 */
function HeroProof({ spec }: { spec: WebsiteSpec }) {
  const rating = spec.business.rating;
  const reviewCount = spec.business.reviewCount;
  const location = spec.business.city ?? spec.business.region;
  if (!rating && !reviewCount && !spec.business.phone && !location) return null;
  const sourceLabel = spec.business.ratingSource === "google" ? "Google" : "Public";
  return (
    <aside className="hidden rounded-[var(--sf-radius-panel)] border border-white/15 bg-white/10 p-6 backdrop-blur md:block">
      {rating ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-highlight)]">
            {sourceLabel} rating
          </p>
          <p className="mt-3 text-5xl font-semibold" style={{ fontFamily: "var(--sf-display-font)" }}>
            {rating.toFixed(1)}
          </p>
          <Stars rating={rating} />
        </>
      ) : null}
      {reviewCount ? (
        <p className={`text-sm text-[var(--sf-deep-ink-muted)] ${rating ? "mt-3" : ""}`}>
          {reviewCount.toLocaleString("en-US")} public reviews
        </p>
      ) : null}
      {spec.business.phone ? (
        <p className={`flex items-center gap-2 text-sm ${rating || reviewCount ? "mt-5 border-t border-white/15 pt-5" : ""}`}>
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{spec.business.phone}</span>
        </p>
      ) : null}
      {location ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--sf-deep-ink-muted)]">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span>{location}</span>
        </p>
      ) : null}
    </aside>
  );
}

function BodySection({
  section,
  spec,
  definition,
  index,
  tracking,
}: {
  section: Section;
  spec: WebsiteSpec;
  definition: TemplateDefinition;
  index: number;
  tracking: Tracking;
}) {
  switch (section.type) {
    case "trust":
      return <TrustBand section={section} spec={spec} />;
    case "services":
      return <ServicesSection section={section} definition={definition} />;
    case "about":
      return <EditorialSection eyebrow="About" heading={section.heading} body={section.body} />;
    case "serviceArea":
      return (
        <EditorialSection
          eyebrow="Coverage"
          heading={section.heading}
          body={section.body}
          tinted
        />
      );
    case "menuPreview":
      return (
        <EditorialSection
          eyebrow="Details"
          heading={section.heading}
          body={section.body}
          link={section.href && section.label ? { href: section.href, label: section.label } : null}
        />
      );
    case "hoursLocation":
      return <VisitSection section={section} spec={spec} tracking={tracking} />;
    case "contact":
      return <ContactSection section={section} tracking={tracking} />;
    case "cta":
      return <FinalCta section={section} tracking={tracking} />;
    case "announcement":
      // A second announcement inside the body would compete with the top bar.
      return index === 0 ? <AnnouncementBar text={section.text} phone={spec.business.phone} tracking={tracking} /> : null;
    default:
      return null;
  }
}

function TrustBand({
  section,
  spec,
}: {
  section: Extract<Section, { type: "trust" }>;
  spec: WebsiteSpec;
}) {
  const items: Array<{ value: string; label: string }> = [];
  if (section.rating) {
    items.push({
      value: section.rating.toFixed(1),
      label: `${spec.business.ratingSource === "google" ? "Google" : "Public"} rating`,
    });
  }
  if (section.reviewCount) {
    items.push({ value: section.reviewCount.toLocaleString("en-US"), label: "Public reviews" });
  }
  const location = spec.business.city ?? spec.business.region;
  if (location) items.push({ value: location, label: "Serving" });
  if (items.length === 0 && !section.note) return null;

  return (
    <section className="border-b border-[var(--sf-hairline)] bg-[var(--sf-band)] px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-12 gap-y-6">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p
              className="text-3xl font-semibold leading-none text-[var(--sf-ink)]"
              style={{ fontFamily: "var(--sf-display-font)" }}
            >
              {item.value}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-ink-muted)]">
              {item.label}
            </p>
          </div>
        ))}
        {section.note ? (
          <p className="max-w-md text-sm leading-6 text-[var(--sf-ink-muted)]">{section.note}</p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Numbered editorial service list. A ranked index with generous rules reads as
 * designed work; an equal grid of rounded cards reads as a template.
 */
function ServicesSection({
  section,
  definition,
}: {
  section: Extract<Section, { type: "services" }>;
  definition: TemplateDefinition;
}) {
  if (section.items.length === 0) return null;
  return (
    <section className="px-4 py-[var(--sf-section-y)]">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] md:items-start">
        <div className="md:sticky md:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-accent)]">
            {definition.family === "professional" ? "Capabilities" : "Services"}
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--sf-display-font)" }}
          >
            {section.heading}
          </h2>
        </div>
        <ul className="min-w-0">
          {section.items.map((item, index) => (
            <ServiceRow key={item.name} item={item} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ServiceRow({ item, index }: { item: ServiceItem; index: number }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-t border-[var(--sf-hairline)] py-6 first:border-t-0 first:pt-0 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6">
      <span
        className="pt-1 text-sm font-semibold tabular-nums text-[var(--sf-accent)]"
        aria-hidden="true"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className="text-xl font-semibold tracking-tight text-[var(--sf-ink)]">{item.name}</h3>
        <p className="mt-2 break-words text-base leading-7 text-[var(--sf-ink-muted)]">{item.summary}</p>
      </div>
    </li>
  );
}

function EditorialSection({
  eyebrow,
  heading,
  body,
  tinted = false,
  link = null,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  tinted?: boolean;
  link?: { href: string; label: string } | null;
}) {
  return (
    <section
      className={`px-4 py-[var(--sf-section-y)] ${
        tinted ? "border-y border-[var(--sf-hairline)] bg-[var(--sf-band)]" : ""
      }`}
    >
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-accent)]">
            {eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--sf-display-font)" }}
          >
            {heading}
          </h2>
        </div>
        <div className="min-w-0">
          <p className="max-w-[calc(100vw-2rem)] break-words text-lg leading-8 text-[var(--sf-ink-muted)] md:max-w-none">
            {body}
          </p>
          {link ? (
            <a
              href={link.href}
              className="mt-6 inline-flex min-h-11 items-center rounded-[var(--sf-radius-control)] border border-[var(--sf-accent)] px-5 text-sm font-semibold text-[var(--sf-accent)] hover:bg-[var(--sf-accent)] hover:text-[var(--sf-accent-ink)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function VisitSection({
  section,
  spec,
  tracking,
}: {
  section: Extract<Section, { type: "hoursLocation" }>;
  spec: WebsiteSpec;
  tracking: Tracking;
}) {
  const hours = displayHours(spec, section.hours);
  const location = section.location;
  if (!location && hours.length === 0 && !spec.business.phone) return null;
  const directions = location ? directionsHref(location) : null;

  return (
    <section className="px-4 py-[var(--sf-section-y)]">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
        <div className="rounded-[var(--sf-radius-panel)] border border-[var(--sf-hairline)] bg-[var(--sf-surface-alt)] p-7">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--sf-accent)]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              {location ? (
                <p className="mt-3 break-words text-base leading-7 text-[var(--sf-ink-muted)]">{location}</p>
              ) : null}
              {spec.business.phone ? (
                <p className="mt-3">
                  <TrackedAnchor
                    href={telHref(spec.business.phone)}
                    label={spec.business.phone}
                    eventType="phone_cta_clicked"
                    className="text-base font-semibold text-[var(--sf-ink)] underline underline-offset-4"
                    tracking={tracking}
                  />
                </p>
              ) : null}
              {directions ? (
                <a
                  href={directions}
                  className="mt-5 inline-flex min-h-11 items-center rounded-[var(--sf-radius-control)] border border-[var(--sf-accent)] px-5 text-sm font-semibold text-[var(--sf-accent)] hover:bg-[var(--sf-accent)] hover:text-[var(--sf-accent-ink)]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Directions
                </a>
              ) : null}
            </div>
          </div>
        </div>
        {hours.length > 0 ? (
          <div className="rounded-[var(--sf-radius-panel)] border border-[var(--sf-hairline)] bg-[var(--sf-surface-alt)] p-7">
            <div className="flex items-center gap-2">
              <Clock className="size-5 shrink-0 text-[var(--sf-accent)]" aria-hidden="true" />
              <h2 className="text-xl font-semibold tracking-tight">Hours</h2>
            </div>
            <dl className="mt-4">
              {hours.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-[var(--sf-hairline)] py-2.5 text-sm last:border-0"
                >
                  <dt className="font-medium text-[var(--sf-ink)]">{row.label}</dt>
                  <dd className="break-words text-[var(--sf-ink-muted)]">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ContactSection({
  section,
  tracking,
}: {
  section: Extract<Section, { type: "contact" }>;
  tracking: Tracking;
}) {
  return (
    <section className="px-4 py-[var(--sf-section-y)]">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-accent)]">
            Get in touch
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--sf-display-font)" }}
          >
            {section.heading}
          </h2>
        </div>
        <dl className="min-w-0 space-y-5">
          {section.phone ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-ink-muted)]">Phone</dt>
              <dd className="mt-1 text-2xl font-semibold">
                <TrackedAnchor
                  href={telHref(section.phone)}
                  label={section.phone}
                  eventType="phone_cta_clicked"
                  className="underline-offset-4 hover:underline"
                  tracking={tracking}
                />
              </dd>
            </div>
          ) : null}
          {section.email ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-ink-muted)]">Email</dt>
              <dd className="mt-1 break-words text-xl font-medium">
                <TrackedAnchor
                  href={`mailto:${section.email}`}
                  label={section.email}
                  eventType="contact_cta_clicked"
                  className="underline-offset-4 hover:underline"
                  tracking={tracking}
                />
              </dd>
            </div>
          ) : null}
          {section.location ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-ink-muted)]">Location</dt>
              <dd className="mt-1 break-words text-lg text-[var(--sf-ink-muted)]">{section.location}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

function FinalCta({
  section,
  tracking,
}: {
  section: Extract<Section, { type: "cta" }>;
  tracking: Tracking;
}) {
  return (
    <section className="px-4 pb-[var(--sf-section-y)] pt-[var(--sf-section-y-tight)]">
      <div className="mx-auto max-w-6xl rounded-[var(--sf-radius-panel)] bg-[var(--sf-deep)] px-7 py-12 text-[var(--sf-deep-ink)] md:px-12 md:py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 md:max-w-2xl">
            <h2
              className="text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--sf-display-font)" }}
            >
              {section.heading}
            </h2>
            <p className="mt-4 break-words text-lg leading-8 text-[var(--sf-deep-ink-muted)]">{section.body}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            {section.ctas.slice(0, 3).map((cta, index) => (
              <CtaButton
                key={`${cta.kind}-${cta.href}`}
                cta={cta}
                variant={index === 0 ? "light" : "ghost"}
                size="lg"
                tracking={tracking}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({
  section,
  spec,
}: {
  section: Extract<Section, { type: "footer" }>;
  spec: WebsiteSpec;
}) {
  return (
    <footer className="border-t border-[var(--sf-hairline)] px-4 py-9 text-sm text-[var(--sf-ink-muted)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-[var(--sf-ink)]">{section.businessName}</p>
        <p className="break-words">{section.note}</p>
        {spec.business.phone ? <p>{spec.business.phone}</p> : null}
      </div>
    </footer>
  );
}

function CtaButton({
  cta,
  variant,
  size = "md",
  tracking,
}: {
  cta: SiteCta;
  variant: "solid" | "light" | "outline" | "ghost";
  size?: "md" | "lg";
  tracking: Tracking;
}) {
  const sizing = size === "lg" ? "min-h-12 px-6 text-base" : "min-h-11 px-5 text-sm";
  const className = `inline-flex items-center justify-center rounded-[var(--sf-radius-control)] font-semibold ${sizing} ${ctaVariantClass(variant)}`;
  return (
    <TrackedAnchor
      href={resolveHref(cta.href, tracking.basePath)}
      label={cta.label}
      eventType={previewEventForCta(cta)}
      className={className}
      tracking={tracking}
    />
  );
}

function ctaVariantClass(variant: "solid" | "light" | "outline" | "ghost"): string {
  if (variant === "solid") {
    return "bg-[var(--sf-accent)] text-[var(--sf-accent-ink)] hover:bg-[var(--sf-accent-hover)]";
  }
  if (variant === "light") {
    return "bg-[var(--sf-surface-alt)] text-[var(--sf-ink)] hover:bg-white";
  }
  if (variant === "outline") {
    return "border border-[var(--sf-accent)] text-[var(--sf-accent)] hover:bg-[var(--sf-accent)] hover:text-[var(--sf-accent-ink)]";
  }
  return "border border-white/25 text-[var(--sf-deep-ink)] hover:bg-white/10";
}

function TrackedAnchor({
  href,
  label,
  className,
  eventType,
  tracking,
}: {
  href: string;
  label: string;
  className: string;
  eventType: PreviewEventType;
  tracking: Tracking;
}) {
  if (tracking.trackingToken || tracking.outreachTrackingToken) {
    return (
      <TrackedCtaLink
        href={href}
        label={label}
        className={className}
        previewToken={tracking.trackingToken}
        outreachToken={tracking.outreachTrackingToken}
        eventType={eventType}
      />
    );
  }
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <p className="mt-1 text-lg text-[var(--sf-highlight)]" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span aria-hidden="true">{"*****".slice(0, rounded)}</span>
      <span aria-hidden="true" className="opacity-40">
        {"*****".slice(rounded)}
      </span>
    </p>
  );
}

/**
 * Structured daily hours are canonical. A legacy free-text hours string is only
 * split for display compatibility and is never reinterpreted into new claims.
 */
function displayHours(spec: WebsiteSpec, fallback: string | null): Array<{ label: string; value: string }> {
  if (spec.business.dailyHours?.length) {
    return spec.business.dailyHours.map((row) => ({ label: row.label, value: row.value }));
  }
  const source = spec.business.hours ?? fallback;
  if (!source) return [];
  return source
    .split(/\r?\n|;/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((value, index) => ({
      label: value.match(/^[A-Za-z]+/)?.[0] ?? `Hours ${index + 1}`,
      value,
    }));
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function directionsHref(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function previewEventForCta(cta: SiteCta): PreviewEventType {
  if (cta.kind === "phone" || cta.kind === "emergency" || cta.href.startsWith("tel:")) {
    return "phone_cta_clicked";
  }
  if (cta.kind === "contact" || cta.href.startsWith("mailto:")) return "contact_cta_clicked";
  return "cta_clicked";
}

function resolveHref(href: string, basePath: string): string {
  if (href === "/") return `${basePath}?page=home`;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes(".")) {
    return `${basePath}?page=${href.slice(1) || "home"}`;
  }
  return href;
}

export const __localBusinessV2Internals = { displayHours, resolveHref, previewEventForCta, ctaVariantClass };
