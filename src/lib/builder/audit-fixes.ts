import type { BuilderAuditInput } from "./types";
import type { BuilderFacts } from "./facts";
import type { AuditFix } from "./types";
import type { TemplateKey } from "./limits";

export function mapAuditFixes(
  audit: BuilderAuditInput,
  facts: BuilderFacts,
  template: TemplateKey,
): AuditFix[] {
  const codes = new Set(audit.findings.map((item) => item.code));
  const fixes: AuditFix[] = [
    {
      findingCode: "missing_viewport",
      addressed: true,
      builderAction: "Draft uses a responsive template with a correct viewport.",
    },
    {
      findingCode: "poor_mobile_metadata",
      addressed: true,
      builderAction: "Draft layout is mobile-first with tappable navigation and CTAs.",
    },
    {
      findingCode: "missing_title",
      addressed: true,
      builderAction: "SEO title is generated from the known business name, category, and city.",
    },
    {
      findingCode: "missing_meta_description",
      addressed: true,
      builderAction: "Meta description is composed from known category and location only.",
    },
    {
      findingCode: "missing_h1",
      addressed: true,
      builderAction: "Homepage uses a single H1 with the business name.",
    },
    {
      findingCode: "http_not_https",
      addressed: true,
      builderAction: "Replacement draft is served over the SiteForge app HTTPS origin.",
    },
  ];

  const phoneFix =
    codes.has("phone_not_clickable") ||
    codes.has("missing_cta") ||
    codes.has("contact_hard_to_find") ||
    codes.has("home_service_phone_cta_missing") ||
    codes.has("restaurant_phone_missing") ||
    codes.has("broken_cta");
  if (phoneFix) {
    fixes.push({
      findingCode: codes.has("phone_not_clickable")
        ? "phone_not_clickable"
        : codes.has("missing_cta")
          ? "missing_cta"
          : "contact_hard_to_find",
      addressed: Boolean(facts.phone),
      builderAction: facts.phone
        ? "Prominent click-to-call and contact CTAs are in the header and hero."
        : "No sourced phone was available, so a phone number was not invented.",
    });
  }

  if (codes.has("home_service_services_undiscoverable") || codes.has("weak_navigation") || codes.has("thin_service_information")) {
    fixes.push({
      findingCode: codes.has("home_service_services_undiscoverable")
        ? "home_service_services_undiscoverable"
        : "weak_navigation",
      addressed: template !== "restaurant-modern",
      builderAction: "Services navigation and a services section are part of the template.",
    });
  }

  const menuProblem =
    codes.has("restaurant_menu_missing") ||
    codes.has("restaurant_menu_pdf") ||
    codes.has("restaurant_menu_broken");
  if (menuProblem) {
    fixes.push({
      findingCode: codes.has("restaurant_menu_pdf")
        ? "restaurant_menu_pdf"
        : codes.has("restaurant_menu_broken")
          ? "restaurant_menu_broken"
          : "restaurant_menu_missing",
      addressed: Boolean(facts.menuLink) || template === "restaurant-modern",
      builderAction: facts.menuLink
        ? "Menu navigation points at the known menu source instead of inventing dishes."
        : "Menu items were not invented; a Menu page is included only as a contact path.",
    });
  }

  const reservationProblem =
    codes.has("restaurant_reservation_broken") ||
    codes.has("restaurant_reservation_unclear");
  if (reservationProblem) {
    fixes.push({
      findingCode: codes.has("restaurant_reservation_broken")
        ? "restaurant_reservation_broken"
        : "restaurant_reservation_unclear",
      addressed: facts.reservationsOffered,
      builderAction: facts.reservationsOffered
        ? "A reservation CTA is shown because the current site offers reservations."
        : "No reservation CTA was added because reservations are not evidenced.",
    });
  }

  if (codes.has("weak_local_signals") || codes.has("missing_location_information") || codes.has("home_service_area_missing")) {
    fixes.push({
      findingCode: codes.has("home_service_area_missing")
        ? "home_service_area_missing"
        : "weak_local_signals",
      addressed: Boolean(facts.city || facts.region),
      builderAction: facts.city
        ? "A location/service-area section uses the sourced city only."
        : "Location copy was omitted because no city/address was sourced.",
    });
  }

  if (codes.has("home_service_emergency_cta_missing")) {
    fixes.push({
      findingCode: "home_service_emergency_cta_missing",
      addressed: facts.emergencyOffered,
      builderAction: facts.emergencyOffered
        ? "An emergency call CTA is shown because the current site claims emergency service."
        : "Emergency service was not invented.",
    });
  }

  if (codes.has("home_service_contact_form_missing")) {
    fixes.push({
      findingCode: "home_service_contact_form_missing",
      addressed: true,
      builderAction: "Contact page includes a clear phone/email path without inventing a mailbox.",
    });
  }

  return uniqueFixes(fixes);
}

function uniqueFixes(fixes: AuditFix[]): AuditFix[] {
  const seen = new Set<string>();
  const out: AuditFix[] = [];
  for (const item of fixes) {
    if (seen.has(item.findingCode)) continue;
    seen.add(item.findingCode);
    out.push(item);
  }
  return out;
}
