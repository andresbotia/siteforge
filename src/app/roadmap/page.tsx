import type { Metadata } from "next";
import { Badge } from "@/components/shared/badge";
import { Card, CardBody } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  MILESTONE_STATUS_LABEL,
  ROADMAP,
  type Milestone,
  type MilestoneStatus,
} from "@/lib/roadmap/roadmap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Roadmap" };

const TONE_BY_STATUS: Record<MilestoneStatus, "info" | "success" | "warning" | "neutral"> = {
  done: "success",
  current: "info",
  next: "warning",
  backlog: "neutral",
};

const SECTIONS: Array<{ status: MilestoneStatus; description: string }> = [
  { status: "current", description: "In progress right now." },
  { status: "next", description: "Queued immediately after the current work." },
  { status: "backlog", description: "Agreed direction, not yet scheduled." },
  { status: "done", description: "Shipped and locked in git history." },
];

/** Read-only. There is no roadmap table and no editing surface; git history is the audit trail. */
export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        title="Roadmap"
        description="Read-only milestone plan. Source of truth is src/lib/roadmap/roadmap.ts -- changes are ordinary reviewable commits, not database edits."
      />
      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const milestones = ROADMAP.filter((item) => item.status === section.status);
          if (milestones.length === 0) return null;
          return (
            <section key={section.status} aria-labelledby={`roadmap-${section.status}`}>
              <div className="mb-3">
                <h2 id={`roadmap-${section.status}`} className="text-sm font-semibold text-foreground">
                  {MILESTONE_STATUS_LABEL[section.status]}
                </h2>
                <p className="text-xs text-muted">{section.description}</p>
              </div>
              <div className="grid gap-3">
                {milestones.map((milestone) => (
                  <MilestoneCard key={milestone.id} milestone={milestone} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">{milestone.id}</span>
          <h3 className="text-sm font-semibold text-foreground">{milestone.title}</h3>
          <Badge tone={TONE_BY_STATUS[milestone.status]}>
            {MILESTONE_STATUS_LABEL[milestone.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted">{milestone.goal}</p>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Exit criteria
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
            {milestone.exitCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">{milestone.notes}</p>
      </CardBody>
    </Card>
  );
}
