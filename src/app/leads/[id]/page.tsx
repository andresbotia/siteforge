import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditRunButton } from "@/components/auditor/audit-run-button";
import { BuildRunButton } from "@/components/builder/build-run-button";
import { LeadLifecyclePanel } from "@/components/leads/lead-lifecycle-panel";
import { VerifiedPublicFactsForm } from "@/components/leads/verified-public-facts-form";
import { CreateOfferForm } from "@/components/offers/create-offer-form";
import { PurchaseLinkPanel } from "@/components/offers/purchase-link-panel";
import { listActivityForLead } from "@/data/activity";
import { listCustomers } from "@/data/customers";
import { getLatestAuditForLead, getLeadById, listAuditsForLead } from "@/data/leads";
import { listCommercialOffersForLead } from "@/data/payments";
import { getPreviewAnalyticsForWebsite } from "@/data/previews";
import { listOutreach } from "@/data/outreach";
import { getLatestWebsiteForLead } from "@/data/websites";
import { isLeadEligibleForAudit } from "@/lib/auditor/eligibility";
import { isLeadEligibleForBuild } from "@/lib/builder/eligibility";
import {
  deriveOperatorActions,
  recommendWebsiteProducer,
  type OperatorActionContext,
  type WebsiteProducer,
} from "@/lib/leads/operator-actions";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ScoreBar, ScoreRing } from "@/components/shared/score-bar";
import {
  CommercialOfferStatusBadge,
  CustomerStatusBadge,
  LeadSourceBadge,
  LeadStatusBadge,
  LeadWebsiteStatusBadge,
  OutreachStatusBadge,
  PaymentEnvironmentBadge,
  QualificationBadge,
} from "@/components/shared/status-badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { asRecord } from "@/lib/json";
import { isManualPublicProspectSource } from "@/lib/prospects/manual-public";

export const dynamic = "force-dynamic";

type LeadPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: LeadPageProps): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLeadById(id);
  return { title: lead?.businessName ?? "Lead" };
}

export default async function LeadDetailPage({ params }: LeadPageProps) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const [audit, audits, activity, website, offers, allOutreach, allCustomers] =
    await Promise.all([
      getLatestAuditForLead(lead.id),
      listAuditsForLead(lead.id),
      listActivityForLead(lead.id),
      getLatestWebsiteForLead(lead.id),
      listCommercialOffersForLead(lead.id),
      listOutreach(),
      listCustomers(),
    ]);

  const outreach = allOutreach.filter((row) => row.leadId === lead.id);
  const customer = allCustomers.find((row) => row.leadId === lead.id) ?? null;
  const previewAnalytics = website
    ? await getPreviewAnalyticsForWebsite(website.id)
    : null;
  const preview = previewAnalytics?.deployment ?? null;

  const canAudit = isLeadEligibleForAudit(lead);
  const canBuild = isLeadEligibleForBuild(lead);

  const actionContext: OperatorActionContext = {
    lead: {
      status: lead.status,
      industry: lead.industry,
      websiteUrl: lead.website,
      inspectionSummary: lead.inspectionSummary,
    },
    website: website ? { id: website.id, hasSpec: Boolean(website.spec) } : null,
    preview: preview ? { status: preview.status, revokedAt: preview.revokedAt } : null,
    hasPendingPreviewApproval: Boolean(previewAnalytics?.pendingApprovalId),
    outreach: outreach.map((row) => ({ kind: row.kind, status: row.status })),
    offers: offers.map((offer) => ({
      status: offer.status,
      setupAmountCents: offer.setupAmountCents,
      managedMonthlyAmountCents: offer.managedMonthlyAmountCents,
      managedPlanSelected: offer.managedPlanSelected,
      purchaseTokenHash:
        offer.purchaseLinkStatus === "not_published" ? null : "published",
      purchaseLinkRevokedAt:
        offer.purchaseLinkStatus === "revoked" ? "revoked" : null,
    })),
    isCustomer: Boolean(customer),
  };
  const operatorActions = deriveOperatorActions(actionContext);
  const isManualPublicProspect = isManualPublicProspectSource(
    lead.discoverySource,
  );
  const isNoStandaloneWebsite = lead.websiteStatus === "no_standalone_website";
  const commercialPotentialRaw = asRecord(lead.inspectionSummary).commercial_potential;
  const commercialPotential = commercialPotentialRaw && typeof commercialPotentialRaw === "object" ? asRecord(commercialPotentialRaw) : null;

  return (
    <>
      <PageHeader
        title={lead.businessName}
        description={`${lead.industry} · ${lead.location}`}
        actions={
          <div className="flex flex-col items-end gap-3">
            {canAudit ? <AuditRunButton leadId={lead.id} /> : null}
            {canBuild ? <BuildRunButton leadId={lead.id} /> : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
        <LeadSourceBadge source={lead.discoverySource} />
        <LeadWebsiteStatusBadge status={lead.websiteStatus} />
        {lead.qualificationTier ? (
          <QualificationBadge tier={lead.qualificationTier} />
        ) : null}
        <Link href="/leads" className="text-xs text-muted hover:text-foreground">
          Back to pipeline
        </Link>
      </div>

      <Card className="mb-4" id="next-actions">
        <CardHeader
          title="Next actions"
          description="Only the actions legal for this business's current state, ordered by proximity to revenue. Derived from the lifecycle transition table and the existing eligibility helpers."
        />
        <CardBody>
          {operatorActions.length === 0 ? (
            <p className="text-sm text-muted">
              No actions available in the current state.
            </p>
          ) : (
            <ul className="space-y-2">
              {operatorActions.map((action) => {
                const isRoute = action.target.startsWith("/");
                return (
                  <li
                    key={action.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded border border-border-subtle p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {action.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{action.description}</p>
                    </div>
                    <Link
                      href={isRoute ? action.target : `#${action.target.replace(/^#/, "")}`}
                      className="shrink-0 rounded border border-border px-2.5 py-1 text-xs text-accent hover:bg-surface-hover"
                    >
                      {isRoute ? "Open" : "Go to control"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {isManualPublicProspect ? (
        <Card className="mb-4">
          <CardBody>
            <p className="text-sm text-muted">
              {isNoStandaloneWebsite
                ? "M9.5D public-data-only prospect with operator-verified no standalone website. Auditor is not applicable; Builder may create a standalone website draft from verified lead facts only."
                : "M9.5B public-data-only prospect. Auditor and Builder may use the existing deterministic public website flow, but no outreach, payment, paid AI, or customer production deployment has been run."}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Card>
          <CardHeader title="Business" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email} />
            <Detail label="Website" value={lead.website} />
            <Detail
              label="Website status"
              value={
                isNoStandaloneWebsite
                  ? "No standalone website"
                  : lead.website
                    ? "Standalone website present"
                    : "Unknown"
              }
            />
            <Detail
              label="Rating"
              value={`${lead.rating.toFixed(1)} · ${formatNumber(lead.reviewCount)} reviews`}
            />
            <Detail
              label="Website score"
              value={isNoStandaloneWebsite ? "Not applicable" : String(lead.websiteScore)}
            />
            <Detail label="Lead score" value={String(lead.leadScore)} />
          </CardBody>
        </Card>
        <Card className="flex items-center justify-center py-6">
          <ScoreRing value={lead.leadScore} label="Lead score" />
        </Card>
      </div>

      <Card className="mt-4" id="lifecycle">
        <CardHeader
          title="Lifecycle"
          description="Operator-set lead status and the optional example domain used in cold outreach copy."
        />
        <CardBody>
          <LeadLifecyclePanel lead={lead} />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Scout qualification"
          description="Deterministic public-business and website-opportunity scores. Not LLM-authored."
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Detail label="Discovery source" value={lead.discoverySource ?? "—"} />
          <Detail
            label="Last Scout run"
            value={
              lead.lastScoutRunId ? (
                <Link
                  href={`/agents/scout/${lead.lastScoutRunId}`}
                  className="text-accent hover:underline"
                >
                  Open run
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Detail
            label="Business strength"
            value={lead.businessStrengthScore === null ? "—" : String(lead.businessStrengthScore)}
          />
          <Detail
            label={isNoStandaloneWebsite ? "New website opportunity" : "Website opportunity"}
            value={
              lead.websiteOpportunityScore === null
                ? "—"
                : String(lead.websiteOpportunityScore)
            }
          />
          <div className="sm:col-span-2">
            <p className="text-[11px] text-muted-foreground uppercase">Reasons</p>
            {lead.qualificationReasons.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No Scout reasons stored.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                {lead.qualificationReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
          {lead.inspectionSummary ? (
            <div className="sm:col-span-2">
              <p className="text-[11px] text-muted-foreground uppercase">
                Inspection
              </p>
              <p className="mt-1 text-sm text-muted">
                Reachable: {String(asRecord(lead.inspectionSummary).reachable ?? "—")}
                {asRecord(lead.inspectionSummary).final_url
                  ? ` · ${String(asRecord(lead.inspectionSummary).final_url)}`
                  : ""}
                {asRecord(lead.inspectionSummary).has_viewport === false
                  ? " · missing viewport"
                  : ""}
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {commercialPotential ? (
        <Card className="mt-4">
          <CardHeader
            title="Commercial potential (Scout)"
            description="Second-stage ranking on top of Scout's business/website scores. Not LLM-authored. Does not by itself invoke Designer or spend anything."
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Detail label="Commercial score" value={String(commercialPotential.score ?? "—")} />
            <Detail label="Recommendation" value={String(commercialPotential.recommendation ?? "—")} />
            <Detail label="Contactability" value={formatContactability(commercialPotential.contactability)} />
            <Detail label="Designer coverage" value={String(commercialPotential.designer_coverage_level ?? "—")} />
            {Array.isArray(commercialPotential.reasons) && commercialPotential.reasons.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="text-[11px] text-muted-foreground uppercase">Reasons</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                  {commercialPotential.reasons.map((reason: unknown, index: number) => (
                    <li key={index}>{String(reason)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {isNoStandaloneWebsite ? (
        <Card className="mt-4">
          <CardHeader
            title="Verified public facts"
            description="Operator-attached public facts for Builder regeneration. Saving does not publish, send outreach, or call paid services."
          />
          <CardBody>
            <VerifiedPublicFactsForm
              leadId={lead.id}
              verifiedPublicFacts={lead.verifiedPublicFacts}
            />
          </CardBody>
        </Card>
      ) : null}

      {audit ? (
        <Card className="mt-4" id="audit">
          <CardHeader
            title="Website audit"
            description={
              audit.auditVersion
                ? `Latest deterministic audit (${audit.auditVersion}). Historical rows are kept when you re-run Auditor.`
                : "Latest persisted audit."
            }
            action={
              <Link href={`/audits/${audit.id}`} className="text-xs text-accent hover:underline">
                Open full audit
              </Link>
            }
          />
          <CardBody>
            <p className="mb-4 text-sm text-muted">
              Audited{audit.createdAt ? ` · ${formatDateTime(audit.createdAt)}` : ""}
              {audit.redesignOpportunityScore !== null
                ? ` · redesign opportunity ${audit.redesignOpportunityScore}`
                : ""}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <ScoreBar label="Website health" value={audit.overallScore} />
              <ScoreBar label="Technical" value={audit.technicalScore ?? audit.performanceScore} />
              <ScoreBar label="SEO" value={audit.seoScore} />
              <ScoreBar
                label="UX / Conversion"
                value={audit.uxScore ?? audit.conversionScore ?? 0}
              />
              <ScoreBar label="Content" value={audit.contentScore ?? audit.designScore} />
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Major findings
              </h3>
              {audit.findings.filter((item) => item.severity === "critical" || item.severity === "high").length === 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {(audit.issues.slice(0, 4).length > 0
                    ? audit.issues.slice(0, 4)
                    : ["No high or critical findings stored."]
                  ).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {audit.findings
                    .filter((item) => item.severity === "critical" || item.severity === "high")
                    .slice(0, 6)
                    .map((item) => (
                      <li key={`${item.code}-${item.title}`}>{item.title}</li>
                    ))}
                </ul>
              )}
            </div>
            {audits.length > 1 ? (
              <p className="mt-4 text-xs text-muted">
                {audits.length} audit records on this lead. Latest is shown.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4" id="audit">
          <CardBody>
            <p className="text-sm text-muted">
              {isNoStandaloneWebsite
                ? "Website audit not applicable. Operator verified there is no standalone site, so SiteForge records a new website opportunity instead of fabricating a crawled audit."
                : `Not audited. ${canAudit ? "Run a website audit from this page." : "This lead is not eligible for Auditor."}`}
            </p>
            {canAudit ? (
              <div className="mt-3">
                <AuditRunButton leadId={lead.id} />
              </div>
            ) : null}
          </CardBody>
        </Card>
      )}

      {website ? (
        <Card className="mt-4" id="website">
          <CardHeader
            title="Website"
            description="Current generated website. Rebuilds create history instead of overwriting."
            action={
              <Link href={`/websites/${website.id}`} className="text-xs text-accent hover:underline">
                Open draft
              </Link>
            }
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Detail label="Template" value={website.template || website.templateKey || "—"} />
            <Detail label="Status" value={website.status} />
            <Detail label="Built" value={formatDateTime(website.createdAt)} />
            <Detail
              label="Internal preview"
              value={
                website.spec ? (
                  <Link href={`/websites/${website.id}/preview`} className="text-accent hover:underline">
                    Open internal preview
                  </Link>
                ) : (
                  "No structured spec on this record"
                )
              }
            />
            <Detail
              label="Public preview"
              value={
                preview
                  ? `${preview.status}${preview.revokedAt ? " (revoked)" : ""}`
                  : previewAnalytics?.pendingApprovalId
                    ? "Approval pending"
                    : "Not requested"
              }
            />
            <Detail
              label="Preview approval"
              value={
                <Link href={`/websites/${website.id}`} className="text-accent hover:underline">
                  Manage preview / request approval
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4" id="website">
          <CardHeader
            title="Create website"
            description="One entry point. Routing is decided by template-registry coverage so you don't have to pick a producer."
          />
          <CardBody className="space-y-3">
            {canBuild ? (
              <CreateWebsiteEntry
                leadId={lead.id}
                producer={actionContext.website ? "builder" : recommendWebsiteProducer(lead.industry)}
              />
            ) : (
              <p className="text-sm text-muted">
                A website can be created once the lead is audited (or, for a
                verified no-website prospect, once it is qualified).
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mt-4" id="offers">
        <CardHeader
          title="Offer & purchase link"
          description="Locked-plan commercial offers, approval binding, and the customer purchase link. Mock payment execution only."
        />
        <CardBody className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {offers.length === 0 ? (
              <p className="text-sm text-muted">No offers yet.</p>
            ) : (
              <ul className="space-y-3">
                {offers.map((offer) => (
                  <li key={offer.id} className="rounded border border-border-subtle p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/offers/${offer.id}`} className="font-medium text-accent hover:underline">
                        Offer {offer.id.slice(0, 8)}
                      </Link>
                      <CommercialOfferStatusBadge status={offer.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Setup cents: {offer.setupAmountCents}
                      {offer.managedPlanSelected && offer.managedMonthlyAmountCents
                        ? `; managed monthly cents: ${offer.managedMonthlyAmountCents}`
                        : ""}
                      {" · purchase link: "}
                      {offer.purchaseLinkStatus.replace("_", " ")}
                    </p>
                    {offer.status === "approved" ||
                    offer.purchaseLinkStatus !== "not_published" ? (
                      <div className="mt-3 border-t border-border-subtle pt-3">
                        <PurchaseLinkPanel offer={offer} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CreateOfferForm lead={lead} website={website} />
        </CardBody>
      </Card>

      <Card className="mt-4" id="outreach">
        <CardHeader
          title="Outreach thread"
          description="Every outreach row for this business — cold and payment follow-up — with status."
        />
        {outreach.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No outreach drafted yet.</p>
        ) : (
          <ul>
            {outreach
              .slice()
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/outreach/${row.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {row.kind === "follow_up" ? "Payment follow-up" : "Cold outreach"}
                      </Link>
                      <OutreachStatusBadge status={row.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {row.subject || "(no subject)"} · {row.recipient || "no recipient"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.sentAt ?? row.createdAt)}
                  </time>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4" id="payment">
        <CardHeader
          title="Payment & customer"
          description="Conversion state for this business. Mock and Stripe TEST payments are never counted as real revenue."
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {customer ? (
            <>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <CustomerStatusBadge status={customer.status} />
                <PaymentEnvironmentBadge environment={customer.paymentEnvironment} />
                <Link
                  href={`/customers/${customer.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Open customer
                </Link>
              </div>
              <Detail label="Plan" value={customer.plan} />
              <Detail
                label="Converted"
                value={customer.convertedAt ? formatDateTime(customer.convertedAt) : "—"}
              />
              <Detail
                label="Managed subscription"
                value={customer.managedSubscriptionStatus ?? "none"}
              />
              <Detail
                label="Monthly revenue (live only)"
                value={`$${customer.monthlyRevenue.toFixed(2)}`}
              />
            </>
          ) : (
            <p className="sm:col-span-2 text-sm text-muted">
              Not a customer yet. A completed checkout (via the webhook) converts
              this business and records the payment environment.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Activity timeline" />
        {activity.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No activity yet.</p>
        ) : (
          <ol>
            {activity.map((item, index) => (
              <li
                key={item.id}
                className="grid grid-cols-[12px_minmax(0,1fr)] gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0"
              >
                <span
                  className={`mt-1.5 size-2 rounded-full ${index === 0 ? "bg-accent" : "bg-border"}`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
                  <time className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(item.timestamp)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

/**
 * M10 Task 2. Single "Create website" entry point. All three underlying
 * producers are unchanged -- this only picks a default based on
 * `needsNewMasterTemplate` (via `recommendWebsiteProducer`) and still exposes
 * the other two.
 */
function CreateWebsiteEntry({
  leadId,
  producer,
}: {
  leadId: string;
  producer: WebsiteProducer;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {producer === "builder"
          ? "Recommended: the deterministic $0 Builder — a template family covers this industry."
          : "Recommended: a Designer Job — no template family covers this industry, so the deterministic Builder would read as generic."}
      </p>
      {producer === "builder" ? (
        <BuildRunButton leadId={leadId} />
      ) : (
        <Link
          href="/agents/designer"
          className="inline-block rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-surface-hover"
        >
          Create a Designer Job
        </Link>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        {producer !== "builder" ? (
          <Link href="/agents/builder" className="text-muted hover:text-foreground">
            Use the deterministic Builder anyway
          </Link>
        ) : (
          <Link href="/agents/designer" className="text-muted hover:text-foreground">
            Create a Designer Job instead
          </Link>
        )}
        <Link href="/websites/import-external" className="text-muted hover:text-foreground">
          Import an externally generated site
        </Link>
      </div>
      <p className="text-[11px] text-muted-foreground">
        None of these deploy, email, buy a domain, or contact the business.
      </p>
    </div>
  );
}

function formatContactability(value: unknown): string {
  const record = asRecord(value);
  if (typeof record.score !== "number") return "—";
  return `${record.score} (${record.verified ? "verified" : "unverified"})`;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  );
}
