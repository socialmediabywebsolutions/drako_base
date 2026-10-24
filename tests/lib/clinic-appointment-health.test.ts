import { describe, expect, it } from "vitest";

import {
  calculateClinicAppointmentHealth,
  type ClinicAppointmentHealthAppointment,
} from "@/lib/clinic/appointment-health";

describe("clinic appointment health domain calculation", () => {
  it("calculates metrics from appointment statuses and dates using legacy-equivalent rules", () => {
    const appointments: ClinicAppointmentHealthAppointment[] = [
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
    ];

    const result = calculateClinicAppointmentHealth(appointments, {
      now: "2099-01-10T08:00:00.000Z",
      lookaheadDays: 7,
      overdueFollowupHours: 24,
    });

    expect(result.config).toEqual({
      lookaheadDays: 7,
      overdueFollowupHours: 24,
    });
    expect(result.metrics).toEqual({
      upcomingAppointments: 3,
      unconfirmedAppointments: 2,
      overdueFollowups: 1,
    });
    expect(result.summary).toBe(
      "Clinic appointment health: 3 upcoming, 2 unconfirmed, 1 overdue followups.",
    );
  });

  it("excludes cancelled, no_show and done from upcoming while keeping unconfirmed logic", () => {
    const appointments: ClinicAppointmentHealthAppointment[] = [
      {
        id: "appt_cancelled",
        status: "CANCELLED",
        scheduledAt: "2099-01-10T09:00:00.000Z",
      },
      {
        id: "appt_no_show",
        status: "NO_SHOW",
        scheduledAt: "2099-01-10T09:30:00.000Z",
      },
      {
        id: "appt_done",
        status: "DONE",
        scheduledAt: "2099-01-10T10:00:00.000Z",
      },
      {
        id: "appt_pending",
        status: "PENDING",
        scheduledAt: "2099-01-10T11:00:00.000Z",
      },
    ];

    const result = calculateClinicAppointmentHealth(appointments, {
      now: "2099-01-10T08:00:00.000Z",
    });

    expect(result.metrics).toEqual({
      upcomingAppointments: 1,
      unconfirmedAppointments: 1,
      overdueFollowups: 0,
    });
  });

  it("uses defaults lookaheadDays=7 and overdueFollowupHours=24 when config is missing or invalid", () => {
    const appointments: ClinicAppointmentHealthAppointment[] = [
      {
        id: "appt_pending",
        status: "PENDING",
        scheduledAt: "2099-01-10T11:00:00.000Z",
      },
      {
        id: "appt_requested_old",
        status: "REQUESTED",
        scheduledAt: "2099-01-09T07:00:00.000Z",
      },
    ];

    const result = calculateClinicAppointmentHealth(appointments, {
      now: "2099-01-10T08:00:00.000Z",
      lookaheadDays: 0,
      overdueFollowupHours: -1,
    });

    expect(result.config).toEqual({
      lookaheadDays: 7,
      overdueFollowupHours: 24,
    });
    expect(result.metrics).toEqual({
      upcomingAppointments: 1,
      unconfirmedAppointments: 1,
      overdueFollowups: 1,
    });
  });

  it("ignores appointments with invalid or missing schedule timestamps", () => {
    const appointments: ClinicAppointmentHealthAppointment[] = [
      {
        id: "appt_missing",
        status: "PENDING",
      },
      {
        id: "appt_invalid",
        status: "REQUESTED",
        scheduledAt: "not-a-date",
      },
      {
        id: "appt_valid",
        status: "REQUESTED",
        scheduledAt: "2099-01-10T10:00:00.000Z",
      },
    ];

    const result = calculateClinicAppointmentHealth(appointments, {
      now: "2099-01-10T08:00:00.000Z",
    });

    expect(result.metrics).toEqual({
      upcomingAppointments: 1,
      unconfirmedAppointments: 1,
      overdueFollowups: 0,
    });
  });

  it("accepts followUpAt as fallback schedule field and normalizes dashed statuses", () => {
    const appointments: ClinicAppointmentHealthAppointment[] = [
      {
        id: "appt_fallback_schedule",
        status: "no-show",
        followUpAt: "2099-01-10T10:00:00.000Z",
      },
      {
        id: "appt_pending_fallback",
        status: "PENDING",
        followUpAt: "2099-01-10T11:00:00.000Z",
      },
    ];

    const result = calculateClinicAppointmentHealth(appointments, {
      now: "2099-01-10T08:00:00.000Z",
    });

    expect(result.metrics).toEqual({
      upcomingAppointments: 1,
      unconfirmedAppointments: 1,
      overdueFollowups: 0,
    });
  });
});
