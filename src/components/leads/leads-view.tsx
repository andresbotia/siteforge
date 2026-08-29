"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/shared/button";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { Dialog } from "@/components/shared/dialog";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { LeadStatusBadge } from "@/components/shared/status-badge";
import { cities, industries } from "@/data";
import { formatDate } from "@/lib/format";
import { leadStatusLabel } from "@/lib/labels";
import type { Lead, LeadStatus } from "@/types";

const statuses: LeadStatus[] = [
  "discovered",
  "auditing",
  "qualified",
  "rejected",
  "building",
  "ready",
];

export function LeadsView({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [scoutOpen, setScoutOpen] = useState(false);

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
      const matchesScore = lead.leadScore >= scoreFloor;
      return (
        matchesQuery &&
        matchesIndustry &&
        matchesLocation &&
        matchesStatus &&
        matchesScore
      );
    });
  }, [industry, leads, location, minScore, query, status]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Fictional South Florida businesses used to exercise the pipeline. These are not real companies."
        actions={
          <Button variant="primary" onClick={() => setScoutOpen(true)}>
            Find Businesses
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
            {statuses.map((item) => (
              <option key={item} value={item}>
                {leadStatusLabel[item]}
              </option>
            ))}
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

      <DataTable>
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Industry</Th>
            <Th>Location</Th>
            <Th>Rating</Th>
            <Th>Reviews</Th>
            <Th>Website Score</Th>
            <Th>Lead Score</Th>
            <Th>Status</Th>
            <Th>Discovered</Th>
          </tr>
        </THead>
        <tbody>
          {filtered.map((lead) => (
            <tr key={lead.id} className="hover:bg-surface-hover/70">
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
              <Td className="tabular-nums">{lead.websiteScore}</Td>
              <Td className="tabular-nums font-medium">{lead.leadScore}</Td>
              <Td>
                <LeadStatusBadge status={lead.status} />
              </Td>
              <Td className="text-muted whitespace-nowrap">
                {formatDate(lead.createdAt)}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <Dialog
        open={scoutOpen}
        onClose={() => setScoutOpen(false)}
        title="Find businesses"
        description="Scout integration will be added in a future milestone."
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <Field label="Location" htmlFor="scout-location">
            <TextInput
              id="scout-location"
              defaultValue="Fort Lauderdale, FL"
            />
          </Field>
          <Field label="Industry" htmlFor="scout-industry">
            <SelectInput id="scout-industry" defaultValue="Plumbing">
              {industries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Number of businesses" htmlFor="scout-count">
            <TextInput
              id="scout-count"
              type="number"
              min={1}
              max={100}
              defaultValue={25}
            />
          </Field>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setScoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled>
              Run Scout
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
