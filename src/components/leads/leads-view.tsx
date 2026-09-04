"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/shared/button";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import { ManualPublicProspectForm } from "@/components/leads/manual-public-prospect-form";
import { PageHeader } from "@/components/shared/page-header";
import {
  LeadSourceBadge,
  LeadStatusBadge,
  LeadWebsiteStatusBadge,
  QualificationBadge,
} from "@/components/shared/status-badge";
import { cities, industries, leadStatuses } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { leadStatusLabel, qualificationTierLabel } from "@/lib/labels";
import type { Lead, QualificationTier } from "@/types";

const qualificationTiers: QualificationTier[] = [
  "high_priority",
  "qualified",
  "review",
  "reject",
];

export function LeadsView({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [source, setSource] = useState("all");
  const [minScore, setMinScore] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const scoreFloor = minScore === "" ? 0 : Number(minScore);

    return leads.filter((lead) => {
      const matchesQuery =
        needle.length === 0 ||
        lead.businessName.toLowerCase().includes(needle) ||
        lead.industry.toLowerCase().includes(needle) ||
        lead.location.toLowerCase().includes(needle);
      const matchesIndustry = industry === "all" || lead.industry === industry;
      const matchesLocation = location === "all" || lead.city === location;
      const matchesStatus = status === "all" || lead.status === status;
      const matchesTier = tier === "all" || lead.qualificationTier === tier;
      const matchesSource =
        source === "all" || (lead.discoverySource ?? "seed") === source;
      const matchesScore = lead.leadScore >= scoreFloor;
      return (
        matchesQuery &&
        matchesIndustry &&
        matchesLocation &&
        matchesStatus &&
        matchesTier &&
        matchesSource &&
        matchesScore
      );
    });
  }, [industry, leads, location, minScore, query, source, status, tier]);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every business, at whatever stage. Open one to operate on it end to end. Seed rows remain fictional."
        actions={
          <Button variant="primary" onClick={() => router.push("/agents/scout")}>
            Find Businesses
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Search" htmlFor="lead-search">
          <TextInput
            id="lead-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Business, industry, city"
          />
        </Field>
        <Field label="Industry" htmlFor="lead-industry">
          <SelectInput
            id="lead-industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          >
            <option value="all">All industries</option>
            {industries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Location" htmlFor="lead-location">
          <SelectInput
            id="lead-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option value="all">All cities</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Status" htmlFor="lead-status">
          <SelectInput
            id="lead-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {leadStatuses.map((item) => (
              <option key={item} value={item}>
                {leadStatusLabel[item]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Qualification" htmlFor="lead-tier">
          <SelectInput
            id="lead-tier"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          >
            <option value="all">All tiers</option>
            {qualificationTiers.map((item) => (
              <option key={item} value={item}>
                {qualificationTierLabel[item]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Source" htmlFor="lead-source">
          <SelectInput
            id="lead-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">All sources</option>
            <option value="scout">Scout</option>
            <option value="manual_public_prospect">Manual public</option>
            <option value="seed">Seed</option>
          </SelectInput>
        </Field>
        <Field label="Minimum score" htmlFor="lead-min-score">
          <TextInput
            id="lead-min-score"
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Showing {filtered.length} of {leads.length} leads
      </p>

      <ManualPublicProspectForm />

      <DataTable>
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Industry</Th>
            <Th>Location</Th>
            <Th>Rating</Th>
            <Th>Reviews</Th>
            <Th>Website Score</Th>
            <Th>Website Status</Th>
            <Th>Lead Score</Th>
            <Th>Opportunity</Th>
            <Th>Qualification</Th>
            <Th>Status</Th>
            <Th>Source</Th>
            <Th>Discovered</Th>
          </tr>
        </THead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={13}
                className="border-t border-border px-3 py-8 text-center text-sm text-muted"
              >
                No leads match these filters.
              </td>
            </tr>
          ) : null}
          {filtered.map((lead) => (
            <tr key={lead.id} className="hover:bg-surface-2/60">
              <Td>
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium text-foreground hover:text-accent"
                >
                  {lead.businessName}
                </Link>
              </Td>
              <Td className="text-muted">{lead.industry}</Td>
              <Td className="text-muted">{lead.location}</Td>
              <Td className="tabular-nums">{lead.rating.toFixed(1)}</Td>
              <Td className="tabular-nums">{lead.reviewCount}</Td>
              <Td className="tabular-nums">
                {lead.websiteStatus === "no_standalone_website" ? "N/A" : lead.websiteScore}
              </Td>
              <Td>
                <LeadWebsiteStatusBadge status={lead.websiteStatus} />
              </Td>
              <Td className="tabular-nums font-medium">{lead.leadScore}</Td>
              <Td className="tabular-nums">
                {lead.websiteOpportunityScore ?? "—"}
              </Td>
              <Td>
                {lead.qualificationTier ? (
                  <QualificationBadge tier={lead.qualificationTier} />
                ) : (
                  "—"
                )}
              </Td>
              <Td>
                <LeadStatusBadge status={lead.status} />
              </Td>
              <Td>
                <LeadSourceBadge source={lead.discoverySource} />
              </Td>
              <Td className="text-muted whitespace-nowrap">
                {formatDate(lead.createdAt)}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

    </>
  );
}
