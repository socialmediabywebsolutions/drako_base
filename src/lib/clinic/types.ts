export const CLINIC_PLAN_CODE = "drako_clinic_starter";

export type ClinicProfile = {
  id: string;
  saasId: string;
  clientId: string | null;
  displayName: string;
  city: string | null;
  roomsCount: number;
  staffCount: number;
  primaryGoal: string | null;
  channels: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicService = {
  id: string;
  saasId: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClinicLead = {
  id: string;
  saasId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  priority: "low" | "medium" | "high";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicAppointment = {
  id: string;
  saasId: string;
  leadId: string | null;
  patientName: string;
  serviceId: string | null;
  startsAt: string;
  endsAt: string | null;
  status: "booked" | "done" | "no-show" | "cancelled";
  roomLabel: string | null;
  staffName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicFinanceEntry = {
  id: string;
  saasId: string;
  appointmentId: string | null;
  serviceName: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  method: string | null;
  createdAt: string;
};

export type ClinicFinanceSummary = {
  totalRevenue: number;
  averageTicket: number;
};

export type ClinicMetrics = {
  leadToBookingRate: number;
  noShowRate: number;
  appointmentsPerWeek: number;
  revenueCurrentMonth: number;
  patientRepeatRate: number;
  totalLeads: number;
  totalAppointments: number;
};

export type ClinicProduct = {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  brand: string | null;
  category: string | null;
  unitLabel: string;
  unitCost: number;
  salePriceDefault: number | null;
  minStockUnits: number;
  currentStockUnits: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClinicServiceProduct = {
  id: string;
  tenantId: string;
  saasId: string;
  serviceId: string;
  productId: string;
  unitsPerService: number;
  wasteFactorPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type ClinicInventoryMovement = {
  id: string;
  tenantId: string;
  saasId: string;
  productId: string;
  movementType: "PURCHASE" | "USAGE" | "ADJUSTMENT";
  quantityUnits: number;
  unitCost: number | null;
  sourceType: "APPOINTMENT" | "MANUAL" | "SUPPLIER_INVOICE" | "OTHER" | null;
  sourceId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicCostEntryCategory =
  | "RENT"
  | "ELECTRICITY"
  | "WATER"
  | "INTERNET"
  | "STAFF_OTHER"
  | "TAXES"
  | "OTHER";

export type ClinicCostEntrySourceType = "INVOICE_EMAIL" | "MANUAL" | "IMPORTED" | null;

export type ClinicCostEntry = {
  id: string;
  tenantId: string;
  saasId: string;
  category: ClinicCostEntryCategory;
  amount: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  sourceType: ClinicCostEntrySourceType;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicOverheadStrategy = "PER_HOUR" | "PER_APPOINTMENT";

export type ClinicPricingSettings = {
  id: string;
  tenantId: string;
  saasId: string;
  targetMarginPercent: number;
  minMarginPercent: number;
  overheadAllocationStrategy: ClinicOverheadStrategy;
  defaultServiceDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type ServicePricingBreakdown = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  productCost: number;
  employeeCost: number;
  overheadCost: number;
  totalCost: number;
  currentPrice: number;
  targetPrice: number;
  marginPercentCurrent: number;
  marginPercentTarget: number;
  isBelowCost: boolean;
  isBelowMinMargin: boolean;
  canSupportNewHire: boolean;
};
