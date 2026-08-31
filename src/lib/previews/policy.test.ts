import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BUILDER_VERSION } from "@/lib/builder/limits";
import { assertPreviewPublicationAllowed } from "./policy";

const validSpec = {
  version: BUILDER_VERSION,
  template: "home-services-modern",
  palette: "navy-amber",
  business: { name: "Acme Plumbing" },
  navigation: [{ id: "home", label: "Home" }],
  pages: [
    {
      id: "home",
      title: "Home",
      description: "Local plumbing help",
      sections: [
        {
          type: "hero",
          headline: "Fast plumbing repairs",
          lede: "Reliable service for homeowners.",
          ctas: [{ kind: "phone", label: "Call now", href: "tel:+15555550100" }],
        },
      ],
    },
  ],
};

describe("preview publication policy", () => {
  it("allows a completed renderable draft without active or pending publication", () => {
    assert.deepEqual(
      assertPreviewPublicationAllowed({
        site: { status: "review_required", spec: validSpec, externalGeneratedSite: null },
        hasActiveDeployment: false,
        hasPendingApproval: false,
      }),
      { ok: true },
    );
  });

  it("blocks invalid specs, active deployments, pending approvals, and incomplete builds", () => {
    assert.equal(
      assertPreviewPublicationAllowed({
        site: { status: "review_required", spec: null, externalGeneratedSite: null },
        hasActiveDeployment: false,
        hasPendingApproval: false,
      }).ok,
      false,
    );
    assert.equal(
      assertPreviewPublicationAllowed({
        site: { status: "review_required", spec: validSpec, externalGeneratedSite: null },
        hasActiveDeployment: true,
        hasPendingApproval: false,
      }).ok,
      false,
    );
    assert.equal(
      assertPreviewPublicationAllowed({
        site: { status: "review_required", spec: validSpec, externalGeneratedSite: null },
        hasActiveDeployment: false,
        hasPendingApproval: true,
      }).ok,
      false,
    );
    assert.equal(
      assertPreviewPublicationAllowed({
        site: { status: "building", spec: validSpec, externalGeneratedSite: null },
        hasActiveDeployment: false,
        hasPendingApproval: false,
      }).ok,
      false,
    );
  });
});
