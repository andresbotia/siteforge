import Image from "next/image";
import type { PageId } from "@/lib/builder/limits";
import type { SiteCta, WebsiteImageAsset, WebsiteSpec } from "@/lib/builder/types";
import type { PreviewEventType } from "@/types";
import { TrackedCtaLink } from "./tracked-cta-link";

type RestaurantModernV2SiteProps = {
  spec: WebsiteSpec;
  pageId: PageId;
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
};

const HIGHLIGHT_LIMIT = 4;

export function RestaurantModernV2Site({
  spec,
  pageId,
  basePath,
  trackingToken,
  outreachTrackingToken,
}: RestaurantModernV2SiteProps) {
  const images = spec.assets?.images ?? [];
  const heroImage = images.find((image) => image.role === "hero") ?? null;
  const galleryImages = images.filter((image) => image.role === "gallery").slice(0, 4);
  const ctas = restaurantCtas(spec);
  const highlights = (spec.business.highlights ?? []).slice(0, HIGHLIGHT_LIMIT);
  const hasVisit = Boolean(spec.business.address ?? spec.business.region ?? spec.business.hours ?? spec.business.phone);

  return (
    <div className="sf-restaurant-v2 min-h-full bg-[#faf7f0] text-[#211f1b]" style={{ colorScheme: "light" }}>
      <RestaurantNav
        spec={spec}
        pageId={pageId}
        basePath={basePath}
        ctas={ctas.slice(0, 1)}
        trackingToken={trackingToken}
        outreachTrackingToken={outreachTrackingToken}
      />
      <RestaurantHero
        spec={spec}
        heroImage={heroImage}
        ctas={ctas.slice(0, 2)}
        basePath={basePath}
        trackingToken={trackingToken}
        outreachTrackingToken={outreachTrackingToken}
      />
      <RestaurantIntro spec={spec} />
      {galleryImages.length > 0 ? <RestaurantGallery images={galleryImages} /> : null}
      <RestaurantCuisine spec={spec} highlights={highlights} />
      <RestaurantReputation spec={spec} />
      {hasVisit ? (
        <RestaurantVisit
          spec={spec}
          ctas={ctas}
          basePath={basePath}
          trackingToken={trackingToken}
          outreachTrackingToken={outreachTrackingToken}
        />
      ) : null}
      <RestaurantFinalCta
        spec={spec}
        ctas={ctas}
        basePath={basePath}
        trackingToken={trackingToken}
        outreachTrackingToken={outreachTrackingToken}
      />
      <RestaurantFooter spec={spec} />
    </div>
  );
}

function RestaurantNav({
  spec,
  pageId,
  basePath,
  ctas,
  trackingToken,
  outreachTrackingToken,
}: {
  spec: WebsiteSpec;
  pageId: PageId;
  basePath: string;
  ctas: SiteCta[];
  trackingToken?: string;
  outreachTrackingToken?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-[#faf7f0]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a className="text-base font-semibold tracking-tight text-[#211f1b]" href={`${basePath}?page=home`}>
          {spec.business.shortName ?? spec.business.name}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-5 text-sm text-[#5c564b] md:flex">
          {["home", "about", "menu", "contact"].map((id) => (
            <a
              key={id}
              href={`${basePath}?page=${id}`}
              className={`underline-offset-4 hover:text-[#211f1b] hover:underline ${pageId === id ? "text-[#211f1b]" : ""}`}
            >
              {navLabel(id)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {ctas.map((cta) => (
            <RestaurantCtaLink
              key={`${cta.kind}-${cta.href}`}
              cta={cta}
              basePath={basePath}
              trackingToken={trackingToken}
              outreachTrackingToken={outreachTrackingToken}
              variant="solid"
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function RestaurantHero({
  spec,
  heroImage,
  ctas,
  basePath,
  trackingToken,
  outreachTrackingToken,
}: {
  spec: WebsiteSpec;
  heroImage: WebsiteImageAsset | null;
  ctas: SiteCta[];
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
}) {
  const category = spec.business.cuisine ?? spec.business.industry;
  const location = spec.business.city ?? spec.business.region;
  return (
    <section className="relative isolate overflow-hidden bg-[#211f1b] text-[#fffaf0]">
      {heroImage ? (
        <Image
          src={heroImage.url}
          alt={heroImage.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
          unoptimized
        />
      ) : (
        <div className="sf-hero-fallback absolute inset-0" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#211f1b]/96 via-[#211f1b]/76 to-[#211f1b]/28" />
      <div className="relative mx-auto grid min-h-[76vh] max-w-6xl content-end gap-8 px-4 pb-12 pt-24 md:grid-cols-[1.2fr_0.8fr] md:items-end md:pb-16">
        <div className="sf-fade-up">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f3c96b] drop-shadow-sm">
            {location ? `${category} in ${location}` : category}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] text-[#fffaf0] drop-shadow-sm md:text-7xl">
            {spec.business.name}
          </h1>
          {spec.business.description ? (
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#fff4d6] drop-shadow-sm md:text-xl">
              {spec.business.description}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {ctas.map((cta) => (
              <RestaurantCtaLink
                key={`${cta.kind}-${cta.href}`}
                cta={cta}
                basePath={basePath}
                trackingToken={trackingToken}
                outreachTrackingToken={outreachTrackingToken}
                variant={cta.kind === "phone" ? "solid" : "light"}
              />
            ))}
          </div>
        </div>
        <RatingBadge spec={spec} />
      </div>
    </section>
  );
}

function RestaurantIntro({ spec }: { spec: WebsiteSpec }) {
  const description = spec.business.description;
  const location = spec.business.address ?? spec.business.region;
  return (
    <section className="border-b border-black/10 px-4 py-12">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.7fr_1.3fr] md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#a6492d]">Welcome</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {spec.business.shortName ?? spec.business.name}
          </h2>
        </div>
        <div className="space-y-4 text-lg leading-8 text-[#4f493f]">
          {description ? <p>{description}</p> : null}
          {location ? <p>{location}</p> : null}
        </div>
      </div>
    </section>
  );
}

function RestaurantGallery({ images }: { images: WebsiteImageAsset[] }) {
  return (
    <section className="px-4 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid h-[520px] gap-3 md:grid-cols-4 md:grid-rows-2">
          {images.map((image, index) => (
            <figure
              key={`${image.url}-${index}`}
              className={`relative overflow-hidden rounded-lg border border-black/10 bg-[#ebe2d2] ${
                index === 0 ? "md:col-span-2 md:row-span-2" : ""
              } ${index === 3 ? "md:col-span-2" : ""}`}
            >
              <Image src={image.url} alt={image.alt} fill sizes="(min-width: 768px) 25vw, 100vw" className="object-cover" unoptimized />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function RestaurantCuisine({ spec, highlights }: { spec: WebsiteSpec; highlights: string[] }) {
  if (!spec.business.cuisine && highlights.length === 0) return null;
  return (
    <section className="bg-[#233c2f] px-4 py-16 text-[#fffaf0]">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f3c96b]">Cuisine</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            {spec.business.cuisine ?? spec.business.industry}
          </h2>
        </div>
        {highlights.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((item) => (
              <div key={item} className="rounded-lg border border-[#fffaf0]/18 bg-[#fffaf0]/8 p-5">
                <p className="text-lg font-medium">{item}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RestaurantReputation({ spec }: { spec: WebsiteSpec }) {
  if (!spec.business.rating && !spec.business.reviewCount) return null;
  const sourceLabel = spec.business.ratingSource === "google" ? "Google" : "Public";
  return (
    <section className="px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#a6492d]">Reputation</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">What guests can verify</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[#211f1b]">
          {spec.business.rating ? (
            <div className="rounded-lg bg-[#faf7f0] px-4 py-3">
              <p className="text-sm text-[#665f53]">{sourceLabel} rating</p>
              <p className="mt-1 text-3xl font-semibold">{spec.business.rating.toFixed(1)}</p>
              <Stars rating={spec.business.rating} />
            </div>
          ) : null}
          {spec.business.reviewCount ? (
            <div className="rounded-lg bg-[#faf7f0] px-4 py-3">
              <p className="text-sm text-[#665f53]">{sourceLabel} reviews</p>
              <p className="mt-1 text-3xl font-semibold">{spec.business.reviewCount.toLocaleString("en-US")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RestaurantVisit({
  spec,
  ctas,
  basePath,
  trackingToken,
  outreachTrackingToken,
}: {
  spec: WebsiteSpec;
  ctas: SiteCta[];
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
}) {
  const hours = parseHours(spec.business.hours);
  const location = spec.business.address ?? spec.business.region;
  return (
    <section className="bg-[#efe6d5] px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#a6492d]">Visit</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Plan a stop</h2>
          {location ? <p className="mt-5 text-lg leading-8 text-[#4f493f]">{location}</p> : null}
          {spec.business.phone ? (
            <p className="mt-2 text-lg text-[#4f493f]">
              <a className="underline underline-offset-4" href={`tel:${spec.business.phone.replace(/[^\d+]/g, "")}`}>
                {spec.business.phone}
              </a>
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {ctas.slice(0, 3).map((cta) => (
              <RestaurantCtaLink
                key={`${cta.kind}-${cta.href}`}
                cta={cta}
                basePath={basePath}
                trackingToken={trackingToken}
                outreachTrackingToken={outreachTrackingToken}
                variant={cta.kind === "phone" ? "solid" : "outline"}
              />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          {hours.length > 0 ? (
            <div className="space-y-2">
              {hours.map((row) => (
                <div key={row} className="sf-hours-row border-b border-black/10 pb-2 text-sm text-[#4f493f] last:border-0">
                  {row}
                </div>
              ))}
            </div>
          ) : (
            <div className="sf-map-fallback min-h-56 rounded-lg border border-dashed border-[#a6492d]/40 bg-[#faf7f0]" aria-hidden="true" />
          )}
        </div>
      </div>
    </section>
  );
}

function RestaurantFinalCta({
  spec,
  ctas,
  basePath,
  trackingToken,
  outreachTrackingToken,
}: {
  spec: WebsiteSpec;
  ctas: SiteCta[];
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
}) {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl rounded-lg bg-[#211f1b] p-8 text-[#fffaf0] md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f3c96b]">Contact</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
          Visit {spec.business.shortName ?? spec.business.name}
        </h2>
        <div className="mt-7 flex flex-wrap gap-3">
          {ctas.slice(0, 3).map((cta) => (
            <RestaurantCtaLink
              key={`${cta.kind}-${cta.href}`}
              cta={cta}
              basePath={basePath}
              trackingToken={trackingToken}
              outreachTrackingToken={outreachTrackingToken}
              variant={cta.kind === "phone" ? "light" : "ghost"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RestaurantFooter({ spec }: { spec: WebsiteSpec }) {
  return (
    <footer className="border-t border-black/10 px-4 py-8 text-sm text-[#665f53]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p>{spec.business.name}</p>
        <p>{spec.business.region ?? spec.business.industry}</p>
      </div>
    </footer>
  );
}

function RatingBadge({ spec }: { spec: WebsiteSpec }) {
  if (!spec.business.rating && !spec.business.reviewCount) return null;
  const sourceLabel = spec.business.ratingSource === "google" ? "Google" : "Public";
  return (
    <div className="hidden rounded-lg border border-white/15 bg-white/12 p-5 text-[#fffaf0] backdrop-blur md:block">
      <p className="text-sm uppercase tracking-[0.12em] text-[#f3c96b]">{sourceLabel} reputation</p>
      {spec.business.rating ? <p className="mt-3 text-5xl font-semibold">{spec.business.rating.toFixed(1)}</p> : null}
      {spec.business.rating ? <Stars rating={spec.business.rating} /> : null}
      {spec.business.reviewCount ? (
        <p className="mt-3 text-sm text-[#fff4d6]/82">{spec.business.reviewCount.toLocaleString("en-US")} public reviews</p>
      ) : null}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <p className="mt-1 text-lg text-[#f3c96b]" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {"*****".slice(0, rounded)}
      <span className="text-[#d8ceb9]">{"*****".slice(rounded)}</span>
    </p>
  );
}

function RestaurantCtaLink({
  cta,
  basePath,
  trackingToken,
  outreachTrackingToken,
  variant,
}: {
  cta: SiteCta;
  basePath: string;
  trackingToken?: string;
  outreachTrackingToken?: string;
  variant: "solid" | "light" | "outline" | "ghost";
}) {
  const href = resolveDraftHref(cta.href, basePath);
  const linkClass = `inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold ${ctaClass(variant)}`;
  if (trackingToken || outreachTrackingToken) {
    return (
      <TrackedCtaLink
        href={href}
        label={cta.label}
        className={linkClass}
        previewToken={trackingToken}
        outreachToken={outreachTrackingToken}
        eventType={previewEventForCta(cta)}
      />
    );
  }
  return (
    <a href={href} className={linkClass}>
      {cta.label}
    </a>
  );
}

function restaurantCtas(spec: WebsiteSpec): SiteCta[] {
  const ctas: SiteCta[] = [];
  if (spec.business.phone) {
    ctas.push({
      kind: "phone",
      label: `Call ${spec.business.phone}`,
      href: `tel:${spec.business.phone.replace(/[^\d+]/g, "")}`,
    });
  }
  if (spec.business.menuUrl) {
    ctas.push({ kind: "menu", label: "View menu", href: spec.business.menuUrl });
  }
  if (spec.business.orderUrl) {
    ctas.push({ kind: "order", label: "Order", href: spec.business.orderUrl });
  }
  if (spec.business.reservationUrl) {
    ctas.push({ kind: "reservation", label: "Reserve a table", href: spec.business.reservationUrl });
  }
  if (spec.business.socialUrl) {
    ctas.push({ kind: "social", label: "Social", href: spec.business.socialUrl });
  }
  ctas.push({ kind: "contact", label: "Contact", href: "/contact" });
  return ctas;
}

function parseHours(hours: string | null | undefined): string[] {
  if (!hours) return [];
  return hours
    .split(/\r?\n|;/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function navLabel(id: string): string {
  if (id === "home") return "Home";
  if (id === "menu") return "Menu";
  if (id === "about") return "About";
  if (id === "contact") return "Visit";
  return id;
}

function ctaClass(variant: "solid" | "light" | "outline" | "ghost"): string {
  if (variant === "solid") return "bg-[#a6492d] text-white hover:bg-[#8e3923]";
  if (variant === "light") return "bg-[#fffaf0] text-[#211f1b] hover:bg-white";
  if (variant === "outline") return "border border-[#a6492d] text-[#a6492d] hover:bg-[#a6492d] hover:text-white";
  return "border border-white/20 text-[#fffaf0] hover:bg-white/10";
}

function previewEventForCta(cta: SiteCta): PreviewEventType {
  if (cta.kind === "phone" || cta.href.startsWith("tel:")) return "phone_cta_clicked";
  if (cta.kind === "contact" || cta.href.startsWith("mailto:")) return "contact_cta_clicked";
  return "cta_clicked";
}

function resolveDraftHref(href: string, basePath: string): string {
  if (href === "/") return `${basePath}?page=home`;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes(".")) {
    return `${basePath}?page=${href.slice(1) || "home"}`;
  }
  return href;
}
