import { describe, expect, it } from "vitest";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

import {
  resolveClinicControlPlaneContext,
  resolveClinicControlPlaneHandlerOutput,
} from "@/lib/clinic/control-plane-context-resolution";

describe("clinic control-plane context resolution", () => {
  it("resolves handler output from context, appointments and config with legacy-equivalent metrics", () => {
    const result = resolveClinicControlPlaneHandlerOutput({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      appointments: [
        {
          id: "appt_upcoming_confirmed",
          status: "CONFIRMED",
          scheduledAt: "2099-01-10T10:00:00.000Z",
        },
        {
          id: "appt_upcoming_pending",
          status: "PENDING",
          scheduledAt: "2099-01-10T12:00:00.000Z",
        },
        {
          id: "appt_upcoming_requested",
          status: "REQUESTED",
          scheduledAt: "2099-01-11T09:00:00.000Z",
        },
        {
          id: "appt_overdue_requested",
          status: "REQUESTED",
          scheduledAt: "2024-01-01T09:00:00.000Z",
        },
        {
          id: "appt_done",
          status: "DONE",
          scheduledAt: "2099-01-12T09:00:00.000Z",
        },
      ],
      config: {
        now: "2099-01-10T08:00:00.000Z",
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
    });

    expect(result).toMatchObject({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      summary: "Clinic appointment health: 3 upcoming, 2 unconfirmed, 1 overdue followups.",
      output: {
        upcomingAppointments: 3,
        unconfirmedAppointments: 2,
        overdueFollowups: 1,
        lookaheadDays: 7,
        overdueFollowupHours: 24,
      },
      health: {
        metrics: {
          upcomingAppointments: 3,
          unconfirmedAppointments: 2,
          overdueFollowups: 1,
        },
      },
    });
  });

  it("keeps tenant and saas identity from resolved context", () => {
    const context = resolveClinicControlPlaneContext({
      tenantId: "tenant_ctx",
      saasId: "clinic_ctx",
    });

    const result = resolveClinicControlPlaneHandlerOutput({
      tenantId: "tenant_ctx",
      saasId: "clinic_ctx",
      appointments: [],
      config: {
        now: "2099-01-10T08:00:00.000Z",
      },
    });

    expect(context).toEqual({
      tenantId: "tenant_ctx",
      saasId: "clinic_ctx",
    });
    expect(result.tenantId).toBe(context.tenantId);
    expect(result.saasId).toBe(context.saasId);
  });

  it("applies default lookahead and overdue config in output when input config is invalid", () => {
    const result = resolveClinicControlPlaneHandlerOutput({
      tenantId: "tenant_defaults",
      saasId: "clinic",
      appointments: [
        {
          id: "appt_pending",
          status: "PENDING",
          scheduledAt: "2099-01-10T11:00:00.000Z",
        },
      ],
      config: {
        now: "2099-01-10T08:00:00.000Z",
        lookaheadDays: 0,
        overdueFollowupHours: -1,
      },
    });

    expect(result.output.lookaheadDays).toBe(7);
    expect(result.output.overdueFollowupHours).toBe(24);
  });

  it("fails when tenantId or saasId is blank", () => {
    expect(() => resolveClinicControlPlaneContext({
      tenantId: "",
      saasId: "clinic",
    })).toThrow("Clinic context-resolution requires tenantId and saasId.");

    expect(() => resolveClinicControlPlaneHandlerOutput({
      tenantId: "tenant",
      saasId: "  ",
      appointments: [],
    })).toThrow("Clinic context-resolution requires tenantId and saasId.");
  });

  it("does not import frozen campobase namespace and uses non-campobase filenames", () => {
    const helperPath = "src/lib/clinic/control-plane-context-resolution.ts";
    const testPath = "tests/lib/clinic-control-plane-context-resolution.test.ts";
    const helperSource = readFileSync(helperPath, "utf8");
    const testSource = readFileSync(testPath, "utf8");
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(helperSource).not.toContain(legacyPrefix);
    expect(testSource).not.toContain(`from "${legacyPrefix}`);
    expect(testSource).not.toContain(`from '${legacyPrefix}`);
    expect(testSource).not.toContain(`import("${legacyPrefix}`);
    expect(testSource).not.toContain(`import('${legacyPrefix}`);

    expect(basename(helperPath).toLowerCase()).not.toContain("campobase");
    expect(basename(testPath).toLowerCase()).not.toContain("campobase");
  });
});
