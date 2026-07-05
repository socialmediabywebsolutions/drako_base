import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OwnerFactoryControlCenter from "@/components/owner/OwnerFactoryControlCenter";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

describe("OwnerFactoryControlCenter", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("queues SaaS creation through the canonical factory route and renders the provisioning timeline", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url === "/api/factory/provisioning/create-saas") {
          return new Response(
            JSON.stringify({
              ok: true,
              jobId: "job_socialflow_1",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        if (url === "/api/factory/provisioning/jobs/job_socialflow_1") {
          return new Response(
            JSON.stringify({
              ok: true,
              job: {
                jobId: "job_socialflow_1",
                saasId: "saas_socialflow",
                state: "success",
                rawState: "SUCCESS",
                timeline: [
                  {
                    type: "state_transition",
                    step: "RUNTIME_DEPLOYED",
                    state: "SUCCESS",
                    status: "done",
                    details: "Runtime contract active.",
                  },
                  {
                    type: "state_transition",
                    step: "BOOTSTRAP_READY",
                    state: "SUCCESS",
                    status: "done",
                    details: "Bootstrap contract ready.",
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

    render(React.createElement(OwnerFactoryControlCenter, {
      tenantName: "Owner tenant",
      tenantRole: "OWNER",
      workspaceSummary: {
        plan: "STARTER",
        billingStatus: "active",
        onboardingProgress: 100,
        onboardingNextStep: null,
        connectedProductsCount: 1,
      },
      initialOverview: {
        counts: {
          activeSaas: 1,
          provisioningRunning: 0,
          degradedJobs: 0,
          activeDomains: 1,
        },
        saases: [
          {
            id: "saas_socialflow",
            tenantId: "tenant_owner",
            name: "SocialFlow",
            slug: "socialflow",
            saasStatus: "active",
            instanceStatus: "active",
            domain: "app.socialflow.example.com",
            domainStatus: "active",
            provisioningStatus: "SUCCESS",
            updatedAt: "2026-03-13T10:00:00.000Z",
          },
        ],
        jobs: [
          {
            jobId: "job_existing",
            saasId: "saas_socialflow",
            state: "SUCCESS",
            updatedAt: "2026-03-13T10:00:00.000Z",
          },
        ],
      },
    }));

    await user.type(screen.getByPlaceholderText("Socialcors"), "SocialFlow");
    await user.type(screen.getByPlaceholderText("socialflows"), "socialflow");
    await user.click(screen.getByRole("button", { name: "Queue provisioning" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/factory/provisioning/create-saas",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    await screen.findByText("Provisioning job job_socialflow_1 queued.");
    await screen.findByText("Factory posture");
    await screen.findByText("RUNTIME_DEPLOYED");
    await screen.findByText("BOOTSTRAP_READY");
    expect(await screen.findByRole("link", { name: "Open SaaS" })).toHaveAttribute(
      "href",
      "/socialflow?__drako_host=app.socialflow.example.com",
    );
    expect(refresh).toHaveBeenCalled();
  });
});
