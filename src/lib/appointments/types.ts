export type AppointmentStatus =
  | "REQUESTED"
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "NO_SHOW"
  | "CANCELLED";

export type SaasAppointment = {
  id: string;
  tenantId: string;
  saasId: string;
  serviceId: string;
  employeeId: string;
  customerId: string | null;
  clientName: string;
  clientContact: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  priceAtBooking: number | null;
  socialCampaignId?: string | null;
  socialPostId?: string | null;
  sourceChannel?: "SOCIAL" | "EMAIL" | "DIRECT" | "REFERRAL" | "OTHER" | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentListFilter = {
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
};
