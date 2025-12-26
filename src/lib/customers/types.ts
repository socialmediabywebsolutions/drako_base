export type CustomerBookingStatus = "REQUESTED" | "CONFIRMED" | "DONE" | "NO_SHOW" | "CANCELLED";

export type SaasCustomerVipLevel = "REGULAR" | "VIP" | "VVIP";

export type CustomerStyleProfile = {
  hairLength?: string;
  hairType?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | string;
  favoriteColors?: string[];
  eventType?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SaasCustomer = {
  id: string;
  tenantId: string;
  saasId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  preferredEmployeeId: string | null;
  preferredServices: string[] | null;
  styleProfile: CustomerStyleProfile | null;
  isVip: boolean;
  vipLevel: SaasCustomerVipLevel;
  createdAt: string;
  updatedAt: string;
};

export type SaasCustomerInput = {
  id?: string;
  saasId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  preferredEmployeeId?: string | null;
  preferredServices?: string[] | null;
  styleProfile?: CustomerStyleProfile | null;
  isVip?: boolean;
  vipLevel?: SaasCustomerVipLevel | null;
};

export type SaasCustomerProfile = {
  id: string;
  tenantId: string;
  saasId: string;
  customerId: string;
  tags: string[] | null;
  preferences: Record<string, unknown> | null;
  birthday: string | null;
  styleProfile: Record<string, unknown> | null;
  lastStyleReviewAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasCustomerStyleNote = {
  id: string;
  tenantId: string;
  saasId: string;
  customerId: string;
  noteType: "HAIR_STYLE" | "COLOR_PREF" | "EVENT" | "WARNING" | "IDEA" | string;
  content: string;
  source: "EMPLOYEE" | "SYSTEM" | "CUSTOMER" | string;
  createdAt: string;
};

export type SaasCustomerBooking = {
  id: string;
  tenantId: string;
  saasId: string;
  customerId: string;
  serviceId: string;
  employeeId: string | null;
  startTime: string;
  endTime: string;
  status: CustomerBookingStatus;
  priceAtBooking: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasCustomerMetrics = {
  id: string;
  tenantId: string;
  saasId: string;
  customerId: string;
  totalVisits: number;
  totalRevenue: number;
  lastVisitAt: string | null;
  avgTicket: number | null;
  noShowCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerValueSnapshot = {
  totalVisits: number;
  totalRevenue: number;
  lastVisitAt: string | null;
  frequencyWeeks: number | null;
  estimatedLtv: number;
};

export type CustomerPartnerSnapshot = {
  customer: SaasCustomer;
  profile: SaasCustomerProfile | null;
  vipLevel: SaasCustomerVipLevel;
  bookingsRecent: SaasCustomerBooking[];
  favoriteServices: Array<{ serviceId: string; name: string; count: number }>;
  estimatedLtv: number;
  styleProfile: Record<string, unknown> | null;
  inventoryWarningsRelevant: Array<{
    serviceId: string;
    inventoryItemId: string;
    name: string;
    isLowStock: boolean;
  }>;
};

export type CustomerBookingWithService = SaasCustomerBooking & {
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
    currentPrice: number;
    recommendedPrice: number | null;
  };
  employee?: {
    id: string;
    fullName: string | null;
  } | null;
};
