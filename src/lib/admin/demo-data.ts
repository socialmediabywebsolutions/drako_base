import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { SAAS_PACK_DEFINITIONS } from "@/lib/packs/definitions";
import type { SaasPackDefinition } from "@/lib/packs/types";
import type {
  DrakoBaselineNeedCategory,
  DrakoTreasuryAccountType,
  DrakoVendorExpensePeriod,
  DrakoVendorExpenseType,
} from "@/lib/owner/vendor-types";
import type { SaasMarketingUsageSource, SaasPaidAdsChannel } from "@/lib/saas/marketing-types";
import type {
  ConversationChannel,
  ConversationDirection,
  ConversationSenderType,
  ConversationStatus,
  NotificationSeverity,
  NotificationType,
} from "@/lib/conversations/types";

// Node-dev-only flags for SocialFlow demo persistence (avoid breaking Cloudflare Workers)
// Node-dev-only flags for SocialFlow demo persistence (avoid breaking Cloudflare Workers)
// NOTE: These are defined once here and reused by SocialFlow demo snapshot helpers later.
const isNode =
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node === "string";
const isNodeDev = isNode && process.env && process.env.NODE_ENV === "development";

function getDevFs(): typeof import("fs") | null {
  if (!isNodeDev) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require("fs") as typeof import("fs");
  } catch {
    return null;
  }
}

function getSocialflowDemoStatePath(): string | null {
  if (!isNodeDev) return null;
  const cwd = typeof process !== "undefined" && process.cwd ? process.cwd() : null;
  if (!cwd) return null;
  // Store snapshot under .next to keep it local to Next dev builds
  return `${cwd}/.next/socialflow-demo.json`;
}

export type DemoOwner = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type DemoClient = {
  id: string;
  owner_id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type DemoSaas = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: "unconfigured" | "pending_dns" | "active";
  created_at: string;
};

export type DemoClinicProfile = {
  id: string;
  tenant_id: string;
  client_id: string;
  saas_id: string;
  display_name: string;
  city: string | null;
  rooms_count: number;
  staff_count: number;
  primary_goal: string | null;
  channels: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasConversation = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string | null;
  channel: ConversationChannel;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_staff_message_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasConversationMessage = {
  id: string;
  tenant_id: string;
  saas_id: string;
  conversation_id: string;
  customer_id: string | null;
  employee_id: string | null;
  sender_type: ConversationSenderType;
  direction: ConversationDirection;
  body: string;
  provider_message_id: string | null;
  created_at: string;
};

export type DemoSaasNotification = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  employee_id: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: number;
  created_at: string;
};

export type DemoWhatsappIdentity = {
  id: string;
  tenant_id: string;
  saas_id: string;
  actor_type: string;
  actor_id: string;
  phone_number: string;
  preferred_language: string | null;
  allowed_channels: string | null;
  consent_flags: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoWhatsappMessage = {
  id: string;
  tenant_id: string;
  saas_id: string;
  phone_number: string;
  direction: string;
  actor_type: string | null;
  actor_id: string | null;
  conversation_id: string | null;
  body: string;
  intent: string | null;
  status: string;
  provider_message_id: string | null;
  metadata: string | null;
  created_at: string;
};

export type DemoSaasTaxProfile = {
  id: string;
  tenant_id: string;
  saas_id: string;
  country: string;
  region: string | null;
  regime: string;
  default_vat_rate: number;
  reduced_vat_rate: number | null;
  super_reduced_vat_rate: number | null;
  uses_withholding: number;
  withholding_rate: number;
  income_tax_mode: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasTaxPeriod = {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_type: string;
  period_key: string;
  start_date: string;
  end_date: string;
  status: string;
  estimated_revenue: number;
  estimated_expenses: number;
  vat_collected: number;
  vat_paid: number;
  vat_due: number;
  income_tax_base: number;
  income_tax_due: number;
  notes: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoClinicService = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DemoClinicLead = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  priority: "low" | "medium" | "high";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoClinicAppointment = {
  id: string;
  tenant_id: string;
  saas_id: string;
  lead_id: string | null;
  patient_name: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "booked" | "done" | "no-show" | "cancelled";
  room_label: string | null;
  staff_name: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoClinicReview = {
  id: string;
  tenant_id: string;
  saas_id: string;
  patient_name: string;
  rating: number;
  text: string;
  source: string | null;
  created_at: string;
};

export type DemoClinicFinanceEntry = {
  id: string;
  tenant_id: string;
  saas_id: string;
  appointment_id: string | null;
  service_name: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  method: string | null;
  created_at: string;
};

export type DemoSaasCustomer = {
  id: string;
  tenant_id: string;
  saas_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  preferred_employee_id: string | null;
  preferred_services: string | null;
  style_profile: string | null;
  is_vip: number;
  vip_level: string;
  created_at: string;
  updated_at: string;
};

export type DemoSaasCustomerProfile = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  tags: string | null;
  preferences: string | null;
  birthday: string | null;
  style_profile_json: string | null;
  last_style_review_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasCustomerStyleNote = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  note_type: string;
  content: string;
  source: string;
  created_at: string;
};

export type DemoSaasCustomerBooking = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  service_id: string;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  status: "REQUESTED" | "CONFIRMED" | "DONE" | "NO_SHOW" | "CANCELLED";
  price_at_booking: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasAppointment = {
  id: string;
  tenant_id: string;
  saas_id: string;
  service_id: string;
  employee_id: string;
  customer_id: string | null;
  client_name: string;
  client_contact: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: "REQUESTED" | "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED";
  price_at_booking: number | null;
  social_campaign_id: string | null;
  social_post_id: string | null;
  source_channel: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasCustomerMetrics = {
  id: string;
  tenant_id: string;
  saas_id: string;
  customer_id: string;
  total_visits: number;
  total_revenue: number;
  last_visit_at: string | null;
  avg_ticket: number | null;
  no_show_count: number;
  created_at: string;
  updated_at: string;
};

export type DemoSaasEmailMessage = {
  id: string;
  tenant_id: string;
  saas_id: string;
  from_address: string;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string;
  classification: string;
  sub_type: string | null;
  status: string;
  parsed_amount: number | null;
  parsed_currency: string | null;
  parsed_due_date: string | null;
  parsed_supplier_name: string | null;
  linked_expense_id: string | null;
  linked_customer_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoClientSaas = {
  id: string;
  client_id: string;
  saas_id: string;
  status: string;
  plan: string | null;
  created_at: string;
};

export type DemoInvoice = {
  id: string;
  client_id: string;
  saas_id: string;
  number: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type DemoTicket = {
  id: string;
  client_id: string;
  saas_id: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  channel: string | null;
  created_at: string;
};

export type DemoProvision = {
  id: string;
  saas_id: string;
  step: string;
  status: string;
  details: string | null;
  created_at: string;
};

export type DemoSaasPlan = {
  id: string;
  tenant_id: string;
  saas_id: string;
  plan_code: string;
  name: string;
  billing_interval: "month" | "year";
  amount: number;
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type DemoSaasPlanFeature = {
  id: string;
  plan_id: string;
  feature_key: string;
  created_at: string;
  updated_at: string;
};

export type DemoClientSaasSubscription = {
  id: string;
  tenant_id: string;
  client_id: string;
  saas_id: string;
  saas_plan_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_code: string;
  status: string;
  current_period_end: number | null;
  created_at: string;
  updated_at: string;
};

export type DemoSubscription = {
  id: string;
  tenant_id: string;
  client_id: string;
  saas_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: string;
  status: string;
  current_period_end: number | null;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeRole = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  label: string;
  description: string | null;
  permissions: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

export type DemoEmployee = {
  id: string;
  tenant_id: string;
  saas_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeSkill = {
  id: string;
  tenant_id: string;
  employee_id: string;
  skill: string;
  level: string;
  created_at: string;
};

export type DemoEmployeeSchedule = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeContract = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  contract_type: "FULL_TIME" | "PART_TIME" | "FREELANCE" | "EXTRA";
  base_salary_monthly: number | null;
  hourly_rate: number | null;
  commission_percent: number | null;
  max_hours_week: number | null;
  min_hours_week: number | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeHrFlag = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  is_underpaid_suspected: number;
  is_overworked_suspected: number;
  is_low_performance_suspected: number;
  last_review_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoHrSettings = {
  id: string;
  tenant_id: string;
  saas_id: string;
  min_hourly_wage: number | null;
  max_weekly_hours: number | null;
  low_activity_appointments: number | null;
  block_overwork: number;
  block_underpay: number;
  min_rest_hours_between_shifts: number;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeTimesheet = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  date: string;
  scheduled_minutes: number;
  worked_minutes: number;
  extra_minutes: number;
  late_minutes: number;
  break_minutes: number;
  source: "MANUAL" | "AUTO" | "ADJUSTMENT";
  created_at: string;
  updated_at: string;
};

export type DemoEmployeePayrollRun = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  base_gross_amount: number;
  overtime_amount: number;
  commission_amount: number;
  other_adjustments: number;
  total_gross_amount: number;
  status: "DRAFT" | "CONFIRMED" | "PAID";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoEmployeeHrEvent = {
  id: string;
  tenant_id: string;
  saas_id: string;
  employee_id: string;
  event_type: string;
  severity: "INFO" | "NOTICE" | "ALERT" | "BLOCKER";
  message: string;
  created_by: "SYSTEM" | "OWNER" | "MANAGER" | "EMPLOYEE";
  created_at: string;
};

export type DemoHrRules = {
  id: string;
  tenant_id: string;
  saas_id: string;
  min_wage_hour: number;
  max_hours_per_week_legal: number;
  max_overtime_per_week: number;
  min_rest_hours_between_shifts: number;
  vacation_days_per_year: number;
  block_illegal_overtime: number;
  block_illegal_wage: number;
  created_at: string;
  updated_at: string;
};

export type DemoSaasService = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  slug: string;
  category: string | null;
  duration_minutes: number;
  current_price: number;
  recommended_price: number | null;
  is_active: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasInventoryItem = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  cost_per_unit: number;
  stock_quantity: number;
  min_stock_quantity: number;
  preferred_supplier: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasInventoryMovement = {
  id: string;
  tenant_id: string;
  saas_id: string;
  inventory_item_id: string;
  type: string;
  quantity: number;
  reason: string | null;
  source: string | null;
  related_service_id: string | null;
  related_employee_id: string | null;
  created_at: string;
};

export type DemoSaasExpense = {
  id: string;
  tenant_id: string;
  saas_id: string;
  type: string;
  label: string;
  amount: number;
  currency: string;
  period: string;
  from_date: string;
  to_date: string | null;
  source: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasPricingSettings = {
  id: string;
  tenant_id: string;
  saas_id: string;
  target_margin_percent: number;
  min_margin_percent: number;
  occupancy_target_percent: number;
  include_payroll: number;
  include_rent: number;
  include_utilities: number;
  include_products: number;
  updated_at: string;
};

export type DemoSaasServiceProduct = {
  id: string;
  tenant_id: string;
  saas_id: string;
  service_id: string;
  inventory_item_id: string;
  quantity_per_service: number;
  metadata: string | null;
};

export type DemoSaasSocialAccount = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  primary: number;
  created_at: string;
  updated_at: string;
};

export type DemoSaasSocialCampaign = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  objective: string;
  status: string;
  target_segment: string;
  start_date: string | null;
  end_date: string | null;
  budget_estimate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasSocialPost = {
  id: string;
  tenant_id: string;
  saas_id: string;
  campaign_id: string | null;
  provider: string;
  content_type: string;
  title: string;
  body: string;
  image_hint: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  external_post_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasSocialMetrics = {
  id: string;
  tenant_id: string;
  saas_id: string;
  post_id: string;
  provider: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  leads_generated: number;
  captured_at: string;
  metadata: string | null;
};

export type DemoSaasDomain = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number;
  status: "pending" | "active" | "paused";
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasBlueprint = {
  id: string;
  tenant_id: string;
  saas_id: string;
  business_type: string;
  primary_goal: string;
  maturity_stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasModule = {
  id: string;
  tenant_id: string;
  saas_id: string;
  code: string;
  label: string;
  phase: number;
  status: string;
  importance: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasInterviewAnswer = {
  id: string;
  tenant_id: string;
  saas_id: string;
  question_code: string;
  answer_text: string;
  metadata: string | null;
  created_at: string;
};

export type DemoSaasTask = {
  id: string;
  tenant_id: string;
  saas_id: string;
  title: string;
  description: string | null;
  category: string;
  source: string;
  status: string;
  severity: string;
  assignee_employee_id: string | null;
  due_date: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasTaskEvent = {
  id: string;
  tenant_id: string;
  saas_id: string;
  task_id: string;
  type: string;
  payload: string | null;
  created_at: string;
};

export type DemoSaasFeature = {
  id: string;
  tenant_id: string;
  saas_id: string;
  feature_key: string;
  label: string;
  category: string;
  status: string;
  source: string;
  phase_order: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasBrandingSettings = {
  id: string;
  tenant_id: string;
  saas_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  danger_color: string;
  success_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  layout_density: string;
  enable_dark_mode: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoSaasUserUiPreference = {
  id: string;
  tenant_id: string;
  saas_id: string;
  user_id: string;
  role_type: string;
  layout_density_override: string | null;
  default_section: string | null;
  hidden_widgets: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoKnowledgeSpace = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  label: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DemoKnowledgeDocument = {
  id: string;
  tenant_id: string;
  saas_id: string;
  space_id: string | null;
  title: string;
  type: string;
  source: string;
  status: string;
  audience: string;
  importance: string;
  summary: string | null;
  content: string;
  tags: string | null;
  created_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: string | null;
};

export type DemoKnowledgeLink = {
  id: string;
  tenant_id: string;
  saas_id: string;
  document_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
};

type DemoTenantState = {
  owner: DemoOwner | null;
  clients: DemoClient[];
  saas: DemoSaas[];
  clientSaas: DemoClientSaas[];
  clinicProfiles: DemoClinicProfile[];
  clinicServices: DemoClinicService[];
  clinicLeads: DemoClinicLead[];
  clinicAppointments: DemoClinicAppointment[];
  clinicReviews: DemoClinicReview[];
  clinicFinance: DemoClinicFinanceEntry[];
  saasPlans: DemoSaasPlan[];
  clientSaasSubscriptions: DemoClientSaasSubscription[];
  invoices: DemoInvoice[];
  tickets: DemoTicket[];
  provisions: DemoProvision[];
  subscriptions: DemoSubscription[];
  saasPlanFeatures: DemoSaasPlanFeature[];
  saasCustomers: DemoSaasCustomer[];
  saasCustomerProfiles: DemoSaasCustomerProfile[];
  saasCustomerBookings: DemoSaasCustomerBooking[];
  saasAppointments: DemoSaasAppointment[];
  saasCustomerMetrics: DemoSaasCustomerMetrics[];
  saasCustomerStyleNotes: DemoSaasCustomerStyleNote[];
  saasEmailMessages: DemoSaasEmailMessage[];
  saasConversations: DemoSaasConversation[];
  saasConversationMessages: DemoSaasConversationMessage[];
  saasNotifications: DemoSaasNotification[];
  saasWhatsappIdentities: DemoWhatsappIdentity[];
  saasWhatsappMessages: DemoWhatsappMessage[];
  saasTaxProfiles: DemoSaasTaxProfile[];
  saasTaxPeriods: DemoSaasTaxPeriod[];
  employeeRoles: DemoEmployeeRole[];
  employees: DemoEmployee[];
  employeeSkills: DemoEmployeeSkill[];
  employeeSchedules: DemoEmployeeSchedule[];
  employeeContracts: DemoEmployeeContract[];
  employeeTimesheets: DemoEmployeeTimesheet[];
  employeePayrollRuns: DemoEmployeePayrollRun[];
  employeeHrEvents: DemoEmployeeHrEvent[];
  employeeHrFlags: DemoEmployeeHrFlag[];
  hrRules: DemoHrRules[];
  hrSettings: DemoHrSettings[];
  saasServices: DemoSaasService[];
  saasInventoryItems: DemoSaasInventoryItem[];
  saasInventoryMovements: DemoSaasInventoryMovement[];
  saasExpenses: DemoSaasExpense[];
  saasPricingSettings: DemoSaasPricingSettings[];
  saasServiceProducts: DemoSaasServiceProduct[];
  saasSocialAccounts: DemoSaasSocialAccount[];
  saasSocialCampaigns: DemoSaasSocialCampaign[];
  saasSocialPosts: DemoSaasSocialPost[];
  saasSocialMetrics: DemoSaasSocialMetrics[];
  saasDomains: DemoSaasDomain[];
  saasBlueprints: DemoSaasBlueprint[];
  saasModules: DemoSaasModule[];
  saasInterviewAnswers: DemoSaasInterviewAnswer[];
  saasFeatures: DemoSaasFeature[];
  saasBrandingSettings: DemoSaasBrandingSettings[];
  saasUserUiPreferences: DemoSaasUserUiPreference[];
  saasTasks: DemoSaasTask[];
  saasTaskEvents: DemoSaasTaskEvent[];
  knowledgeSpaces: DemoKnowledgeSpace[];
  knowledgeDocuments: DemoKnowledgeDocument[];
  knowledgeLinks: DemoKnowledgeLink[];
  baselineNeeds: DemoBaselineNeed[];
  vendorExpenses: DemoVendorExpense[];
  treasuryAccounts: DemoTreasuryAccount[];
  treasuryMovements: DemoTreasuryMovement[];
  saasMarketingPlans: DemoSaasMarketingPlan[];
  saasMarketingUsage: DemoSaasMarketingUsage[];
  saasPaidAdsSpend: DemoSaasPaidAdsSpend[];
};

type SocialflowDemoSnapshot = {
  tenants: {
    [tenantId: string]: {
      saasSocialAccounts?: DemoSaasSocialAccount[];
      saasSocialCampaigns?: DemoSaasSocialCampaign[];
      saasSocialPosts?: DemoSaasSocialPost[];
      saasSocialMetrics?: DemoSaasSocialMetrics[];
    };
  };
};

export type DemoTenantStateSnapshot = DemoTenantState;

export const tenantStore = new Map<string, DemoTenantState>();
let externalDemoTenantStateCache: Map<string, DemoTenantStateSnapshot> | null | undefined;

function loadSocialflowDemoSnapshot(): SocialflowDemoSnapshot | null {
  if (!isNodeDev) return null;
  const fs = getDevFs();
  if (!fs) return null;
  try {
    if (!fs.existsSync(SOCIALFLOW_DEMO_SNAPSHOT_PATH)) return null;
    const raw = fs.readFileSync(SOCIALFLOW_DEMO_SNAPSHOT_PATH, "utf8");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SocialflowDemoSnapshot;
    // Dev-only trace
    // eslint-disable-next-line no-console
    console.log("[SOCIALFLOW_DEMO] load snapshot", {
      path: SOCIALFLOW_DEMO_SNAPSHOT_PATH,
      tenants: Object.keys(parsed.tenants ?? {}),
    });
    if (!parsed || typeof parsed !== "object" || !parsed.tenants) return null;
    return parsed;
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[SOCIALFLOW_DEMO] failed to load snapshot", SOCIALFLOW_DEMO_SNAPSHOT_PATH);
    return null;
  }
}

function saveSocialflowDemoSnapshot(tenantId: string): void {
  if (!isNodeDev) return;
  const fs = getDevFs();
  if (!fs) return;
  const state = tenantStore.get(tenantId);
  if (!state) return;

  const current: SocialflowDemoSnapshot = loadSocialflowDemoSnapshot() ?? { tenants: {} };
  current.tenants[tenantId] = {
    saasSocialAccounts: state.saasSocialAccounts,
    saasSocialCampaigns: state.saasSocialCampaigns,
    saasSocialPosts: state.saasSocialPosts,
    saasSocialMetrics: state.saasSocialMetrics,
  };

  try {
    const dir = require("path").dirname(SOCIALFLOW_DEMO_SNAPSHOT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SOCIALFLOW_DEMO_SNAPSHOT_PATH, JSON.stringify(current, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log("[SOCIALFLOW_DEMO] save snapshot", {
      path: SOCIALFLOW_DEMO_SNAPSHOT_PATH,
      tenantId,
      accounts: state.saasSocialAccounts.length,
      campaigns: state.saasSocialCampaigns.length,
      posts: state.saasSocialPosts.length,
      metrics: state.saasSocialMetrics.length,
    });
  } catch {
    // Swallow errors in dev persistence to avoid breaking demo
  }
}

const NOW = "2024-05-01T10:00:00.000Z";

const DEFAULT_STATE: DemoTenantState = {
  owner: {
    id: "owner_demo_core",
    name: "DRĀKO Systems",
    nif: "B12345678",
    email: "admin@drako.systems",
    phone: "+34 600 000 000",
    country: "Spain",
    city: "Barcelona",
    address: "Passeig de Gràcia 1",
    created_at: NOW,
  },
  clients: [
    {
      id: "client_demo_clinic",
      owner_id: "owner_demo_core",
      name: "Clínica Demo",
      nif: "C12345678",
      email: "facturacion@clinicademo.com",
      phone: "+34 611 111 111",
      country: "Spain",
      city: "Madrid",
      address: "Calle Demo 123",
      created_at: NOW,
    },
    {
      id: "client_demo_studio",
      owner_id: "owner_demo_core",
      name: "Studio Creativo",
      nif: "S87654321",
      email: "hello@studiocreativo.io",
      phone: "+34 622 222 222",
      country: "Spain",
      city: "Valencia",
      address: "Avenida Demo 45",
      created_at: NOW,
    },
  ],
  hrSettings: [
    {
      id: "hr_settings_demo_operativo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      min_hourly_wage: 10.5,
      max_weekly_hours: 40,
      low_activity_appointments: 3,
      block_overwork: 1,
      block_underpay: 0,
      min_rest_hours_between_shifts: 0,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saas: [
    {
      id: "saas_demo_operativo",
      name: "Campamento Base",
      slug: "campamento-base",
      domain: "demo.drako.systems",
      subdomain: null,
      status: "active",
      public_domain: "clinicademo.com",
      public_subdomain: "clinica-demo.drako.systems",
      domain_status: "active",
      created_at: NOW,
    },
    {
      id: "saas_demo_lanzamiento",
      name: "Orion Analytics",
      slug: "orion-analytics",
      domain: null,
      subdomain: "orion-demo.pages.dev",
      status: "pending",
      public_domain: null,
      public_subdomain: null,
      domain_status: "unconfigured",
      created_at: NOW,
    },
    {
      id: "saas_demo_scale",
      name: "Atlas Growth",
      slug: "atlas-growth",
      domain: null,
      subdomain: "atlas-demo.pages.dev",
      status: "active",
      public_domain: null,
      public_subdomain: null,
      domain_status: "active",
      created_at: NOW,
    },
  ],
  clinicProfiles: [
    {
      id: "clinic_profile_demo",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      display_name: "Clínica Demo 360",
      city: "Madrid",
      rooms_count: 3,
      staff_count: 4,
      primary_goal: "fill_agenda",
      channels: { web: true, instagram: true, whatsapp: true },
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clinicServices: [
    {
      id: "clinic_service_facial",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Facial Glow",
      duration_minutes: 75,
      base_price: 9500,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "clinic_service_fisio",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Sesión de fisioterapia",
      duration_minutes: 60,
      base_price: 7000,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clinicLeads: [
    {
      id: "clinic_lead_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Laura Pérez",
      email: "laura@example.com",
      phone: "+34 600 321 000",
      source: "instagram",
      interest: "Lifting facial",
      status: "contacted",
      priority: "high",
      notes: "Quiere financiación",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "clinic_lead_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Carlos Gómez",
      email: "carlos@example.com",
      phone: "+34 600 654 000",
      source: "web",
      interest: "Fisioterapia deportiva",
      status: "new",
      priority: "medium",
      notes: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clinicAppointments: [
    {
      id: "clinic_appt_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      lead_id: "clinic_lead_1",
      patient_name: "Laura Pérez",
      service_id: "clinic_service_facial",
      starts_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      ends_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      status: "done",
      room_label: "Cabina 1",
      staff_name: "Sara",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "clinic_appt_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      lead_id: "clinic_lead_2",
      patient_name: "Carlos Gómez",
      service_id: "clinic_service_fisio",
      starts_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(),
      status: "booked",
      room_label: "Cabina 2",
      staff_name: "Andrés",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clinicReviews: [
    {
      id: "clinic_review_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      patient_name: "Laura Pérez",
      rating: 5,
      text: "Servicio impecable, repetiré seguro.",
      source: "google",
      created_at: NOW,
    },
  ],
  clinicFinance: [
    {
      id: "clinic_fin_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      appointment_id: "clinic_appt_1",
      service_name: "Facial Glow",
      amount: 9500,
      currency: "EUR",
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      method: "card",
      created_at: NOW,
    },
  ],
  saasCustomers: [
    {
      id: "customer_laura_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Laura Cliente",
      email: "laura.cliente@example.com",
      phone: "+34 600 888 111",
      notes: "Prefiere tonos cálidos y visitas cada 6 semanas.",
      preferred_employee_id: "employee_demo_mario",
      preferred_services: JSON.stringify(["saas_service_full_color", "saas_service_balayage"]),
      style_profile: JSON.stringify({ hair_length: "medium", hair_type: "normal", favorite_colors: ["cobrizo", "miel"] }),
      is_vip: 1,
      vip_level: "VIP",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_carlos_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Carlos Cliente",
      email: "carlos.cliente@example.com",
      phone: "+34 600 222 333",
      notes: "Busca cortes rápidos entre reuniones.",
      preferred_employee_id: "employee_demo_ana",
      preferred_services: JSON.stringify(["saas_service_haircut_basic"]),
      style_profile: JSON.stringify({ hair_length: "short", hair_type: "fine", event_type: "job" }),
      is_vip: 0,
      vip_level: "REGULAR",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_marta_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Marta Vega",
      email: "marta.vega@example.com",
      phone: "+34 600 444 555",
      notes: "Le encantan los tonos fantasía y cuidado intensivo.",
      preferred_employee_id: "employee_demo_mario",
      preferred_services: JSON.stringify(["saas_service_balayage"]),
      style_profile: JSON.stringify({ hair_length: "short", hair_type: "thick", favorite_colors: ["violeta", "azul"] }),
      is_vip: 1,
      vip_level: "VVIP",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_irene_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Irene Soler",
      email: "irene.soler@example.com",
      phone: "+34 600 111 222",
      notes: "Prefiere servicios sencillos y rápidos.",
      preferred_employee_id: null,
      preferred_services: JSON.stringify(["saas_service_haircut_basic"]),
      style_profile: JSON.stringify({ hair_length: "medium", hair_type: "normal", risk_level: "low" }),
      is_vip: 0,
      vip_level: "REGULAR",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasCustomerProfiles: [
    {
      id: "customer_profile_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      tags: JSON.stringify(["HAIR_COLOR:WARM", "STYLE:CLASSIC"]),
      preferences: JSON.stringify({ tone: "cálido", avoid: ["decoloraciones agresivas"] }),
      birthday: "1992-07-18",
      style_profile_json: JSON.stringify({ cut: "capas suaves", hairType: "normal", notes: "color calido" }),
      last_style_review_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
      metadata: JSON.stringify({ loyalty: "gold" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_profile_carlos",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_carlos_cliente",
      tags: JSON.stringify(["STYLE:BUSY", "FREQUENCY:MONTHLY"]),
      preferences: JSON.stringify({ finish: "mate", extras: ["masaje de cuero cabelludo corto"] }),
      birthday: null,
      style_profile_json: JSON.stringify({ cut: "degradado", hairType: "fino", notes: "mantenimiento mensual" }),
      last_style_review_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_profile_marta",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_marta_cliente",
      tags: JSON.stringify(["COLOR:FANTASY", "STYLE:BOLD"]),
      preferences: JSON.stringify({ tone: "morado", avoid: ["rubios frios"] }),
      birthday: "1995-02-10",
      style_profile_json: JSON.stringify({ cut: "bob corto", hairType: "grueso", notes: "le gusta cambiar" }),
      last_style_review_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      metadata: JSON.stringify({ loyalty: "platinum" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "customer_profile_irene",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_irene_cliente",
      tags: JSON.stringify(["STYLE:MINIMAL", "FREQUENCY:SEASONAL"]),
      preferences: JSON.stringify({ finish: "natural", extras: [] }),
      birthday: null,
      style_profile_json: JSON.stringify({ cut: "media melena", hairType: "normal", notes: "poco mantenimiento" }),
      last_style_review_at: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasCustomerBookings: [
    {
      id: "booking_laura_color_done",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      service_id: "saas_service_full_color",
      employee_id: "employee_demo_mario",
      start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      end_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 90).toISOString(),
      status: "DONE",
      price_at_booking: 95,
      notes: "Color cálido + hidratación",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "booking_laura_balayage_upcoming",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      service_id: "saas_service_balayage",
      employee_id: "employee_demo_mario",
      start_time: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      end_time: new Date(Date.now() + 1000 * 60 * 60 * 7).toISOString(),
      status: "CONFIRMED",
      price_at_booking: 140,
      notes: "Añadir brillo frío en puntas",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "booking_carlos_haircut",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_carlos_cliente",
      service_id: "saas_service_haircut_basic",
      employee_id: "employee_demo_ana",
      start_time: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      end_time: new Date(Date.now() + 1000 * 60 * 60 * 2 + 1000 * 60 * 30).toISOString(),
      status: "CONFIRMED",
      price_at_booking: 25,
      notes: "Prefiere laterales muy cortos",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "booking_marta_balayage_done",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_marta_cliente",
      service_id: "saas_service_balayage",
      employee_id: "employee_demo_ana",
      start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      end_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 + 1000 * 60 * 60 * 2).toISOString(),
      status: "DONE",
      price_at_booking: 130,
      notes: "Mechas moradas suaves",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "booking_irene_blowdry",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_irene_cliente",
      service_id: "saas_service_blow_dry",
      employee_id: "employee_demo_mario",
      start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      end_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60 + 1000 * 60 * 45).toISOString(),
      status: "DONE",
      price_at_booking: 30,
      notes: "Secado rapido",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasAppointments: [
    {
      id: "saas_appt_mario_full_color",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_full_color",
      employee_id: "employee_demo_mario",
      customer_id: "customer_laura_cliente",
      client_name: "Lucía Romero",
      client_contact: "lucia.romero@example.com",
      scheduled_start: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      scheduled_end: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      status: "CONFIRMED",
      price_at_booking: 75,
      social_campaign_id: null,
      social_post_id: null,
      source_channel: "DIRECT",
      notes: "Prefiere tono dorado suave.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_appt_ana_haircut",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_haircut_basic",
      employee_id: "employee_demo_ana",
      customer_id: "customer_carlos_cliente",
      client_name: "Sofía Martínez",
      client_contact: "+34 611 222 555",
      scheduled_start: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      scheduled_end: new Date(Date.now() + 1000 * 60 * 60 * 2 + 1000 * 60 * 35).toISOString(),
      status: "CONFIRMED",
      price_at_booking: 25,
      social_campaign_id: "social_campaign_roots_monday",
      social_post_id: "social_post_roots_2",
      source_channel: "SOCIAL",
      notes: "Corte rápido con laterales limpios.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_appt_mario_balayage_done",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_balayage",
      employee_id: "employee_demo_mario",
      customer_id: "customer_marta_cliente",
      client_name: "Paula Díaz",
      client_contact: "paula.diaz@example.com",
      scheduled_start: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      scheduled_end: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: "DONE",
      price_at_booking: 130,
      social_campaign_id: "social_campaign_roots_monday",
      social_post_id: "social_post_roots_1",
      source_channel: "SOCIAL",
      notes: "Balayage frio con brillo final.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_appt_laura_full_color_done",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_full_color",
      employee_id: "employee_demo_laura",
      customer_id: "customer_laura_cliente",
      client_name: "Laura Gómez",
      client_contact: "laura.gomez@example.com",
      scheduled_start: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      scheduled_end: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      status: "DONE",
      price_at_booking: 95,
      social_campaign_id: null,
      social_post_id: null,
      source_channel: "DIRECT",
      notes: "Color completo con brillo.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_appt_javier_blowdry_done",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_blow_dry",
      employee_id: "employee_demo_javier",
      customer_id: "customer_irene_cliente",
      client_name: "Irene Soler",
      client_contact: "irene.soler@example.com",
      scheduled_start: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
      scheduled_end: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
      status: "DONE",
      price_at_booking: 28,
      social_campaign_id: null,
      social_post_id: null,
      source_channel: "DIRECT",
      notes: "Secado basico.",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasCustomerStyleNotes: [
    {
      id: "style_note_laura_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      note_type: "COLOR_PREF",
      content: "Le encanta el morado pero prefiere tonos cálidos.",
      source: "EMPLOYEE",
      created_at: NOW,
    },
    {
      id: "style_note_marta_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_marta_cliente",
      note_type: "IDEA",
      content: "Le gusta cambiar de look cada visita.",
      source: "SYSTEM",
      created_at: NOW,
    },
  ],
  saasEmailMessages: [
    {
      id: "email_demo_invoice_utilities",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      from_address: "facturas@endesa.com",
      from_name: "Endesa",
      to_address: "hola@pelu-demo.com",
      subject: "Factura luz marzo",
      snippet: "Factura de electricidad por 180,45 €.",
      body: "Adjuntamos la factura de luz del mes. Importe total: 180,45 €.",
      received_at: NOW,
      classification: "INVOICE",
      sub_type: "INVOICE_UTILITY",
      status: "NEW",
      parsed_amount: 180.45,
      parsed_currency: "EUR",
      parsed_due_date: null,
      parsed_supplier_name: "Endesa",
      linked_expense_id: null,
      linked_customer_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "email_demo_invoice_products",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      from_address: "ventas@tintespro.com",
      from_name: "TintesPro",
      to_address: "hola@pelu-demo.com",
      subject: "Factura productos color",
      snippet: "Factura por productos: 320,00 €.",
      body: "Factura por tinte morado y oxidante. Total 320,00 EUR.",
      received_at: NOW,
      classification: "INVOICE",
      sub_type: "INVOICE_PRODUCTS",
      status: "NEW",
      parsed_amount: 320,
      parsed_currency: "EUR",
      parsed_due_date: null,
      parsed_supplier_name: "TintesPro",
      linked_expense_id: null,
      linked_customer_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "email_demo_supplier_offer",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      from_address: "ofertas@proveedorcolor.com",
      from_name: "Proveedor Color",
      to_address: "hola@pelu-demo.com",
      subject: "Oferta tinte morado 9,50 €",
      snippet: "Lista de precios con descuento para tinte morado.",
      body: "Tinte morado a 9,50 € por unidad. Oferta limitada.",
      received_at: NOW,
      classification: "SUPPLIER",
      sub_type: "QUOTE_SUPPLIER",
      status: "NEW",
      parsed_amount: 9.5,
      parsed_currency: "EUR",
      parsed_due_date: null,
      parsed_supplier_name: "Proveedor Color",
      linked_expense_id: null,
      linked_customer_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "email_demo_lead",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      from_address: "maria.lead@example.com",
      from_name: "Maria Lopez",
      to_address: "hola@pelu-demo.com",
      subject: "Quiero pedir cita para mechas",
      snippet: "Hola, me gustaria una cita para mechas.",
      body: "Quiero pedir hora para mechas balayage la semana que viene.",
      received_at: NOW,
      classification: "LEAD",
      sub_type: null,
      status: "NEW",
      parsed_amount: null,
      parsed_currency: null,
      parsed_due_date: null,
      parsed_supplier_name: null,
      linked_expense_id: null,
      linked_customer_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasConversations: [
    {
      id: "conv_demo_whatsapp_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      channel: "WHATSAPP",
      subject: "Cambio de hora para mañana",
      status: "OPEN",
      last_message_at: NOW,
      last_customer_message_at: NOW,
      last_staff_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 30).toISOString(),
      metadata: JSON.stringify({ threadType: "whatsapp", externalId: "wa_demo_001" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 90).toISOString(),
      updated_at: NOW,
    },
    {
      id: "conv_demo_instagram_lead",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: null,
      channel: "INSTAGRAM_DM",
      subject: "Campaña balayage primavera",
      status: "PENDING",
      last_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
      last_customer_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
      last_staff_message_at: null,
      metadata: JSON.stringify({ campaignId: "social_campaign_spring", handle: "@maria_color" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 45).toISOString(),
      updated_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "conv_demo_email_quote",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_carlos_cliente",
      channel: "EMAIL",
      subject: "Presupuesto pack cuidado masculino",
      status: "RESOLVED",
      last_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
      last_customer_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 300).toISOString(),
      last_staff_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
      metadata: JSON.stringify({ emailThreadId: "email_demo_001" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 600).toISOString(),
      updated_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
    },
  ],
  saasConversationMessages: [
    {
      id: "conv_msg_demo_whatsapp_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: "customer_laura_cliente",
      employee_id: "employee_demo_mario",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "¡Hola Laura! Te esperamos mañana a las 10:00 con Mario.",
      provider_message_id: "wa_msg_owner_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 50).toISOString(),
    },
    {
      id: "conv_msg_demo_whatsapp_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: "customer_laura_cliente",
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "¿Podemos moverlo a las 11:00? Tengo reunión a las 9",
      provider_message_id: "wa_msg_customer_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 35).toISOString(),
    },
    {
      id: "conv_msg_demo_whatsapp_3",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: "customer_laura_cliente",
      employee_id: "employee_demo_mario",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "Claro, lo cambio a las 11:00. ¿Te parece bien?",
      provider_message_id: "wa_msg_owner_002",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "conv_msg_demo_instagram_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_instagram_lead",
      customer_id: null,
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "¡Hola! Vi vuestra campaña de balayage, ¿tenéis hueco esta semana?",
      provider_message_id: "ig_msg_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "conv_msg_demo_email_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_email_quote",
      customer_id: "customer_carlos_cliente",
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "Hola equipo, ¿me podéis enviar presupuesto para el pack cuidado masculino?",
      provider_message_id: "email_demo_msg_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 310).toISOString(),
    },
    {
      id: "conv_msg_demo_email_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_email_quote",
      customer_id: "customer_carlos_cliente",
      employee_id: "employee_demo_ana",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "Hola Carlos, el pack completo son 110€. Incluye corte, limpieza y masaje. ¿Quieres que te reserve?",
      provider_message_id: "email_demo_msg_002",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
    },
  ],
  saasNotifications: [
    {
      id: "notif_demo_new_lead",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: null,
      type: "EMAIL_LEAD",
      severity: "INFO",
      title: "Nuevo lead desde email",
      body: "Carlos Cliente solicitó presupuesto pack cuidado masculino.",
      related_entity_type: "CONVERSATION",
      related_entity_id: "conv_demo_email_quote",
      is_read: 0,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 200).toISOString(),
    },
    {
      id: "notif_demo_whatsapp_unread",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      type: "CONVERSATION_NEW_MESSAGE",
      severity: "WARNING",
      title: "Laura pidió mover su cita",
      body: "Revisa WhatsApp, queda pendiente confirmar la reprogramación.",
      related_entity_type: "CONVERSATION",
      related_entity_id: "conv_demo_whatsapp_laura",
      is_read: 0,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "notif_demo_social_alert",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: null,
      type: "SOCIAL_CAMPAIGN_ALERT",
      severity: "INFO",
      title: "Campaña de primavera lista",
      body: "Recuerda programar los posts sugeridos para la campaña de balayage.",
      related_entity_type: "SOCIAL_CAMPAIGN",
      related_entity_id: "social_campaign_spring",
      is_read: 0,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 45).toISOString(),
    },
  ],
  saasWhatsappIdentities: [
    {
      id: "wa_identity_owner_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "SAAS_OWNER",
      actor_id: "owner_demo_core",
      phone_number: "+34 600 000 000",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS", "TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Owner demo" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_employee_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_mario",
      phone_number: "+34 666 111 111",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ role: "color" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_employee_ana",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_ana",
      phone_number: "+34 666 222 222",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ role: "recepcion" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_customer_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      phone_number: "+34 600 111 222",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Laura Cliente" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_customer_carlos",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "CUSTOMER",
      actor_id: "customer_carlos_cliente",
      phone_number: "+34 600 333 444",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Carlos Cliente" }),
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasWhatsappMessages: [
    {
      id: "wa_msg_demo_inbound_customer",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 111 222",
      direction: "INBOUND",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "mis citas hoy",
      intent: "SHOW_APPOINTMENTS_TODAY",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_outbound_customer",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 111 222",
      direction: "OUTBOUND",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "Hoy tienes cita a las 10:00.",
      intent: "SHOW_APPOINTMENTS_TODAY",
      status: "SENT",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_inbound_employee",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 666 111 111",
      direction: "INBOUND",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_mario",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "agenda hoy",
      intent: "SHOW_TODAY_SCHEDULE",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_inbound_owner",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 000 000",
      direction: "INBOUND",
      actor_type: "SAAS_OWNER",
      actor_id: "owner_demo_core",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "resumen hoy",
      intent: "SHOW_DAILY_SUMMARY",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_inbound_owner_tax",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 000 000",
      direction: "INBOUND",
      actor_type: "SAAS_OWNER",
      actor_id: "owner_demo_core",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "resumen impuestos",
      intent: "SHOW_TAX_SUMMARY",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
  ],
  saasTaxProfiles: [
    {
      id: "tax_profile_demo_operativo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      country: "ES",
      region: "ES-CAT",
      regime: "GENERAL",
      default_vat_rate: 21,
      reduced_vat_rate: 10,
      super_reduced_vat_rate: 4,
      uses_withholding: 1,
      withholding_rate: 7,
      income_tax_mode: "ESTIMATE_ONLY",
      metadata: JSON.stringify({ model: "303/130" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "tax_profile_demo_lanzamiento",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_lanzamiento",
      country: "ES",
      region: "ES-MAD",
      regime: "SIMPLIFIED",
      default_vat_rate: 21,
      reduced_vat_rate: 10,
      super_reduced_vat_rate: 4,
      uses_withholding: 0,
      withholding_rate: 0,
      income_tax_mode: "ESTIMATE_ONLY",
      metadata: JSON.stringify({ model: "303" }),
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasTaxPeriods: [
    {
      id: "tax_period_demo_2025q1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      period_type: "QUARTERLY",
      period_key: "2025Q1",
      start_date: "2025-01-01T00:00:00.000Z",
      end_date: "2025-03-31T23:59:59.999Z",
      status: "CALCULATED",
      estimated_revenue: 22000,
      estimated_expenses: 14000,
      vat_collected: 3810,
      vat_paid: 2430,
      vat_due: 1380,
      income_tax_base: 8000,
      income_tax_due: 560,
      notes: "Estimación demo para Q1.",
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasCustomerMetrics: [
    {
      id: "metrics_laura_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      total_visits: 1,
      total_revenue: 95,
      last_visit_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      avg_ticket: 95,
      no_show_count: 0,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "metrics_carlos_cliente",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_carlos_cliente",
      total_visits: 0,
      total_revenue: 0,
      last_visit_at: null,
      avg_ticket: null,
      no_show_count: 0,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeRoles: [
    {
      id: "role_owner",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "OWNER",
      label: "Propietaria",
      description: "Responsable última de negocio y cumplimiento.",
      permissions: { payroll: true, hr_settings: true, scheduling: true },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "role_manager",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "MANAGER",
      label: "Manager",
      description: "Coordina operaciones y agenda.",
      permissions: { scheduling: true, coaching: true },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "role_stylist",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "STYLIST",
      label: "Estilista",
      description: "Especialista en estética y color.",
      permissions: { services: true },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "role_assistant",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "ASSISTANT",
      label: "Asistente",
      description: "Apoyo operativo y logística.",
      permissions: { scheduling: true },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "role_reception",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "RECEPTION",
      label: "Recepción",
      description: "Atención al cliente y agenda.",
      permissions: { scheduling: true, payments: true },
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "role_accountant",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "ACCOUNTANT",
      label: "Contabilidad",
      description: "Control financiero y nóminas.",
      permissions: { payroll: true, finance: true },
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employees: [
    {
      id: "employee_demo_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Dra. Laura Méndez",
      email: "laura@clinicademo.com",
      phone: "+34 600 100 200",
      role: "Directora médica",
      avatar_url: null,
      notes: "Especialista en medicina estética avanzada.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "employee_demo_javier",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Javier Torres",
      email: "javier@clinicademo.com",
      phone: "+34 600 300 400",
      role: "Fisioterapeuta senior",
      avatar_url: null,
      notes: "Lleva la agenda de los deportistas.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "employee_demo_ana",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Ana Ruiz",
      email: "ana@clinicademo.com",
      phone: "+34 600 555 999",
      role: "Recepcionista",
      avatar_url: null,
      notes: "Coordina recordatorios y pagos.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "employee_demo_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      full_name: "Mario López",
      email: "mario@clinicademo.com",
      phone: "+34 600 777 123",
      role: "Especialista en color y apoyo fines de semana",
      avatar_url: null,
      notes: "Refuerza agenda en picos de demanda, trabaja por horas y comisiones.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeSkills: [
    {
      id: "skill_demo_estetica",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_laura",
      skill: "Medicina estética",
      level: "expert",
      created_at: NOW,
    },
    {
      id: "skill_demo_ultrasonido",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_laura",
      skill: "Ultrasonido focalizado",
      level: "advanced",
      created_at: NOW,
    },
    {
      id: "skill_demo_fisio",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_javier",
      skill: "Fisioterapia deportiva",
      level: "advanced",
      created_at: NOW,
    },
    {
      id: "skill_demo_masaje",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_javier",
      skill: "Terapia manual",
      level: "intermediate",
      created_at: NOW,
    },
    {
      id: "skill_demo_whatsapp",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_ana",
      skill: "Atención WhatsApp",
      level: "expert",
      created_at: NOW,
    },
    {
      id: "skill_demo_color",
      tenant_id: DEMO_TENANT_ID,
      employee_id: "employee_demo_mario",
      skill: "Colorimetría avanzada",
      level: "advanced",
      created_at: NOW,
    },
  ],
  employeeSchedules: [
    {
      id: "sched_demo_laura_lunes",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 45,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "sched_demo_javier_miercoles",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_javier",
      day_of_week: 3,
      start_time: "12:00",
      end_time: "20:00",
      break_minutes: 30,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "sched_demo_ana_lunes",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_ana",
      day_of_week: 1,
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 30,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "sched_demo_mario_sabado",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      day_of_week: 6,
      start_time: "10:00",
      end_time: "18:00",
      break_minutes: 60,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeContracts: [
    {
      id: "contract_demo_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      contract_type: "FULL_TIME",
      base_salary_monthly: 3600,
      hourly_rate: null,
      commission_percent: null,
      max_hours_week: 40,
      min_hours_week: 35,
      start_date: "2022-09-01",
      end_date: null,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "contract_demo_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      contract_type: "EXTRA",
      base_salary_monthly: null,
      hourly_rate: 18,
      commission_percent: 12,
      max_hours_week: 30,
      min_hours_week: 10,
      start_date: "2023-03-15",
      end_date: null,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "contract_demo_ana",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_ana",
      contract_type: "PART_TIME",
      base_salary_monthly: 1400,
      hourly_rate: null,
      commission_percent: null,
      max_hours_week: 30,
      min_hours_week: 20,
      start_date: "2021-06-01",
      end_date: null,
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeHrFlags: [
    {
      id: "flag_demo_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      is_underpaid_suspected: 0,
      is_overworked_suspected: 1,
      is_low_performance_suspected: 0,
      last_review_at: "2024-04-06T21:00:00.000Z",
      notes: "Supervisar horas extra en abril",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "flag_demo_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      is_underpaid_suspected: 1,
      is_overworked_suspected: 1,
      is_low_performance_suspected: 0,
      last_review_at: "2024-04-08T09:00:00.000Z",
      notes: "Horas extras reiteradas y comisión ajustada",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeTimesheets: [
    {
      id: "timesheet_laura_mon",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      date: "2024-04-01",
      scheduled_minutes: 480,
      worked_minutes: 495,
      extra_minutes: 15,
      late_minutes: 0,
      break_minutes: 30,
      source: "AUTO",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "timesheet_laura_tue",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      date: "2024-04-02",
      scheduled_minutes: 480,
      worked_minutes: 450,
      extra_minutes: 0,
      late_minutes: 5,
      break_minutes: 25,
      source: "AUTO",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "timesheet_laura_sat",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      date: "2024-04-06",
      scheduled_minutes: 0,
      worked_minutes: 240,
      extra_minutes: 240,
      late_minutes: 0,
      break_minutes: 20,
      source: "ADJUSTMENT",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "timesheet_mario_sat",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      date: "2024-04-06",
      scheduled_minutes: 480,
      worked_minutes: 510,
      extra_minutes: 30,
      late_minutes: 0,
      break_minutes: 25,
      source: "MANUAL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "timesheet_mario_sun",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      date: "2024-04-07",
      scheduled_minutes: 0,
      worked_minutes: 360,
      extra_minutes: 360,
      late_minutes: 10,
      break_minutes: 30,
      source: "MANUAL",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeePayrollRuns: [
    {
      id: "payroll_laura_mar",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      period_start: "2024-03-01",
      period_end: "2024-03-31",
      base_gross_amount: 3600,
      overtime_amount: 180,
      commission_amount: 0,
      other_adjustments: 0,
      total_gross_amount: 3780,
      status: "PAID",
      notes: "Liquidado el 5 de abril.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "payroll_laura_apr_draft",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      period_start: "2024-04-01",
      period_end: "2024-04-30",
      base_gross_amount: 3600,
      overtime_amount: 220,
      commission_amount: 0,
      other_adjustments: 0,
      total_gross_amount: 3820,
      status: "DRAFT",
      notes: "Incluir bonus de fidelización si aplica.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "payroll_mario_apr_draft",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      period_start: "2024-04-01",
      period_end: "2024-04-30",
      base_gross_amount: 0,
      overtime_amount: 540,
      commission_amount: 260,
      other_adjustments: 0,
      total_gross_amount: 800,
      status: "DRAFT",
      notes: "Horas registradas pendiente de validar extras domingo.",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  employeeHrEvents: [
    {
      id: "hr_event_late_ana",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_ana",
      event_type: "LATE_ARRIVAL",
      severity: "NOTICE",
      message: "Retraso de 12 min el 2 de abril por avería de transporte.",
      created_by: "SYSTEM",
      created_at: "2024-04-02T09:00:00.000Z",
    },
    {
      id: "hr_event_overtime_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_laura",
      event_type: "WARNING_OVERTIME",
      severity: "ALERT",
      message: "Ha superado las horas máximas semanales configuradas. Revisa descansos.",
      created_by: "SYSTEM",
      created_at: "2024-04-06T21:00:00.000Z",
    },
    {
      id: "hr_event_performance_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      event_type: "GENERAL_NOTICE",
      severity: "INFO",
      message: "Comentarios positivos de clientes sobre servicios de color.",
      created_by: "MANAGER",
      created_at: "2024-04-05T12:00:00.000Z",
    },
  ],
  hrRules: [
    // Estas reglas son configuraciones de negocio para demo, no asesoría legal.
    {
      id: "hr_rules_demo_operativo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      min_wage_hour: 9.5,
      max_hours_per_week_legal: 40,
      max_overtime_per_week: 8,
      min_rest_hours_between_shifts: 11,
      vacation_days_per_year: 23,
      block_illegal_overtime: 1,
      block_illegal_wage: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clientSaas: [
    {
      id: "link_demo_clinic_campamento",
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      status: "active",
      plan: "growth",
      created_at: NOW,
    },
    {
      id: "link_demo_studio_orion",
      client_id: "client_demo_studio",
      saas_id: "saas_demo_lanzamiento",
      status: "trial",
      plan: "starter",
      created_at: NOW,
    },
    {
      id: "link_demo_clinic_atlas",
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_scale",
      status: "active",
      plan: "pro",
      created_at: NOW,
    },
  ],
  saasPlans: [
    {
      id: "plan_demo_campamento_growth",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      plan_code: "campamento_growth",
      name: "Campamento Growth",
      billing_interval: "month",
      amount: 29000,
      currency: "EUR",
      stripe_product_id: "prod_demo_campamento",
      stripe_price_id: "price_demo_campamento_growth",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_demo_campamento_enterprise",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      plan_code: "campamento_enterprise",
      name: "Campamento Enterprise",
      billing_interval: "year",
      amount: 320000,
      currency: "EUR",
      stripe_product_id: "prod_demo_campamento",
      stripe_price_id: "price_demo_campamento_enterprise",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_demo_orion_basic",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_lanzamiento",
      plan_code: "orion_basic",
      name: "Orion Basic",
      billing_interval: "month",
      amount: 90000,
      currency: "EUR",
      stripe_product_id: "prod_demo_orion",
      stripe_price_id: "price_demo_orion_basic",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_demo_atlas_pro",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_scale",
      plan_code: "atlas_pro",
      name: "Atlas Pro",
      billing_interval: "month",
      amount: 600000,
      currency: "EUR",
      stripe_product_id: "prod_demo_atlas",
      stripe_price_id: "price_demo_atlas_pro",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_drako_clinic_starter",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      plan_code: "drako_clinic_starter",
      name: "Drako Clinic Starter",
      billing_interval: "month",
      amount: 7900,
      currency: "EUR",
      stripe_product_id: "prod_demo_clinic",
      stripe_price_id: "price_demo_clinic",
      status: "active",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  clientSaasSubscriptions: [
    {
      id: "css_demo_clinic_campamento",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      saas_plan_id: "plan_drako_clinic_starter",
      stripe_customer_id: "cus_demo_clinic",
      stripe_subscription_id: "sub_demo_clinic_starter",
      plan_code: "drako_clinic_starter",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 45,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "css_demo_studio_campamento",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_studio",
      saas_id: "saas_demo_operativo",
      saas_plan_id: "plan_demo_campamento_growth",
      stripe_customer_id: "cus_demo_studio",
      stripe_subscription_id: "sub_demo_campamento_growth",
      plan_code: "campamento_growth",
      status: "trialing",
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "css_demo_studio_orion",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_studio",
      saas_id: "saas_demo_lanzamiento",
      saas_plan_id: "plan_demo_orion_basic",
      stripe_customer_id: "cus_demo_studio",
      stripe_subscription_id: "sub_demo_orion_basic",
      plan_code: "orion_basic",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "css_demo_clinic_atlas",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_scale",
      saas_plan_id: "plan_demo_atlas_pro",
      stripe_customer_id: "cus_demo_clinic",
      stripe_subscription_id: "sub_demo_atlas_pro",
      plan_code: "atlas_pro",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  invoices: [
    {
      id: "invoice_demo_1",
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      number: "INV-2024-001",
      amount_cents: 250000,
      currency: "EUR",
      status: "paid",
      notes: "Retainer mensual",
      created_at: NOW,
    },
    {
      id: "invoice_demo_2",
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      number: "INV-2024-002",
      amount_cents: 250000,
      currency: "EUR",
      status: "sent",
      notes: null,
      created_at: NOW,
    },
    {
      id: "invoice_demo_3",
      client_id: "client_demo_studio",
      saas_id: "saas_demo_lanzamiento",
      number: "INV-2024-010",
      amount_cents: 180000,
      currency: "EUR",
      status: "draft",
      notes: "Proyecto en despliegue",
      created_at: NOW,
    },
  ],
  tickets: [
    {
      id: "ticket_demo_1",
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      subject: "Error en dashboard financiero",
      description: "El módulo de cashflow no muestra datos actualizados.",
      status: "open",
      priority: "high",
      channel: "email",
      created_at: NOW,
    },
    {
      id: "ticket_demo_2",
      client_id: "client_demo_studio",
      saas_id: null,
      subject: "Solicitud de acceso API",
      description: "Necesitan documentación para integrar CRM.",
      status: "in_progress",
      priority: "normal",
      channel: "slack",
      created_at: NOW,
    },
  ],
  provisions: [
    {
      id: "prov_demo_1",
      saas_id: "saas_demo_operativo",
      step: "done",
      status: "completed",
      details: "Provisioning completado",
      created_at: NOW,
    },
    {
      id: "prov_demo_2",
      saas_id: "saas_demo_lanzamiento",
      step: "pages_project",
      status: "running",
      details: "Creando infraestructura en Pages",
      created_at: NOW,
    },
  ],
  subscriptions: [
    {
      id: "sub_demo_1",
      tenant_id: DEMO_TENANT_ID,
      client_id: "client_demo_clinic",
      saas_id: "saas_demo_operativo",
      stripe_customer_id: "cus_demo_123",
      stripe_subscription_id: "sub_demo_123",
      plan: "drako_base_starter",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasPlanFeatures: [
    {
      id: "plan_feature_clinic_economy",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "ECONOMY",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_hr",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "HR",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_employees",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "EMPLOYEES",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_staff_portal",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "STAFF_PORTAL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_client_portal",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "CLIENT_PORTAL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_email_intake",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "EMAIL_INTAKE",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_social",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "SOCIAL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_owner_control",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "OWNER_CONTROL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_tasks",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "TASKS",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_knowledge",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "KNOWLEDGE",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_clinic_blueprint",
      plan_id: "plan_drako_clinic_starter",
      feature_key: "BLUEPRINT",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_campamento_growth_economy",
      plan_id: "plan_demo_campamento_growth",
      feature_key: "ECONOMY",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_campamento_growth_social",
      plan_id: "plan_demo_campamento_growth",
      feature_key: "SOCIAL",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "plan_feature_campamento_growth_tasks",
      plan_id: "plan_demo_campamento_growth",
      feature_key: "TASKS",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasServices: [
    {
      id: "saas_service_haircut_basic",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Haircut basic",
      slug: "haircut-basic",
      category: "HAIR_SERVICE",
      duration_minutes: 30,
      current_price: 25,
      recommended_price: null,
      is_active: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_service_full_color",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Full color",
      slug: "full-color",
      category: "HAIR_SERVICE",
      duration_minutes: 120,
      current_price: 65,
      recommended_price: null,
      is_active: 1,
      metadata: JSON.stringify({
        phases: [
          { id: "apply", label: "Aplicacion", phaseType: "APPLY", durationMinutes: 15 },
          { id: "process", label: "Procesado", phaseType: "PROCESS", durationMinutes: 30 },
          { id: "rinse-style", label: "Aclarado y styling", phaseType: "RINSE", durationMinutes: 20 },
        ],
      }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_service_balayage",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Balayage",
      slug: "balayage",
      category: "HAIR_SERVICE",
      duration_minutes: 180,
      current_price: 120,
      recommended_price: null,
      is_active: 1,
      metadata: JSON.stringify({
        phases: [
          { id: "apply", label: "Aplicacion", phaseType: "APPLY", durationMinutes: 20 },
          { id: "process", label: "Procesado", phaseType: "PROCESS", durationMinutes: 35 },
          { id: "rinse-style", label: "Aclarado y styling", phaseType: "RINSE", durationMinutes: 25 },
        ],
      }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_service_blow_dry",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Blow dry",
      slug: "blow-dry",
      category: "HAIR_SERVICE",
      duration_minutes: 45,
      current_price: 30,
      recommended_price: null,
      is_active: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasInventoryItems: [
    {
      id: "saas_item_tinte_morado",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Tinte morado",
      sku: "HAIR-DYE-PURPLE",
      category: "HAIR_DYE",
      unit: "ml",
      cost_per_unit: 0.08,
      stock_quantity: 500,
      min_stock_quantity: 120,
      preferred_supplier: "ColorLab",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_item_tinte_dorado",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Tinte dorado",
      sku: "HAIR-DYE-GOLD",
      category: "HAIR_DYE",
      unit: "ml",
      cost_per_unit: 0.07,
      stock_quantity: 450,
      min_stock_quantity: 120,
      preferred_supplier: "ColorLab",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_item_oxidante",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Oxidante 20 vol",
      sku: "OXIDANT-20V",
      category: "OXIDANT",
      unit: "ml",
      cost_per_unit: 0.03,
      stock_quantity: 900,
      min_stock_quantity: 200,
      preferred_supplier: "ChemCare",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_item_shampoo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Champú neutro",
      sku: "SHAMPOO-NEUTRAL",
      category: "SHAMPOO",
      unit: "ml",
      cost_per_unit: 0.02,
      stock_quantity: 1200,
      min_stock_quantity: 300,
      preferred_supplier: "SalonLab",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_item_mask",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Mascarilla reparadora",
      sku: "MASK-REPAIR",
      category: "OTHER",
      unit: "ml",
      cost_per_unit: 0.05,
      stock_quantity: 650,
      min_stock_quantity: 200,
      preferred_supplier: "SalonLab",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_item_gloves",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Guantes desechables",
      sku: "GLOVES-PAIR",
      category: "TOOL",
      unit: "unit",
      cost_per_unit: 0.2,
      stock_quantity: 120,
      min_stock_quantity: 40,
      preferred_supplier: "SafeHands",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasInventoryMovements: [
    {
      id: "move_demo_mario_color_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      inventory_item_id: "saas_item_tinte_morado",
      type: "OUT",
      quantity: 60,
      reason: "SERVICE_USAGE",
      source: "SERVICE_USAGE",
      related_service_id: "saas_service_balayage",
      related_employee_id: "employee_demo_mario",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "move_demo_mario_color_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      inventory_item_id: "saas_item_oxidante",
      type: "OUT",
      quantity: 50,
      reason: "SERVICE_USAGE",
      source: "SERVICE_USAGE",
      related_service_id: "saas_service_balayage",
      related_employee_id: "employee_demo_mario",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "move_demo_laura_cut_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      inventory_item_id: "saas_item_gloves",
      type: "OUT",
      quantity: 1,
      reason: "SERVICE_USAGE",
      source: "SERVICE_USAGE",
      related_service_id: "saas_service_haircut_basic",
      related_employee_id: "employee_demo_laura",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
  saasExpenses: [
    {
      id: "saas_expense_rent",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "RENT",
      label: "Alquiler local",
      amount: 1200,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_expense_electricity",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "UTILITIES",
      label: "Luz",
      amount: 180,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_expense_water",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "UTILITIES",
      label: "Agua",
      amount: 60,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_expense_internet",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "UTILITIES",
      label: "Internet",
      amount: 45,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_expense_products",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "PRODUCTS",
      label: "Productos consumibles",
      amount: 350,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_expense_marketing",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      type: "MARKETING",
      label: "Marketing local",
      amount: 220,
      currency: "EUR",
      period: "MONTHLY",
      from_date: NOW,
      to_date: null,
      source: "MANUAL",
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasPricingSettings: [
    {
      id: "saas_pricing_settings_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      target_margin_percent: 40,
      min_margin_percent: 25,
      occupancy_target_percent: 80,
      include_payroll: 1,
      include_rent: 1,
      include_utilities: 1,
      include_products: 1,
      updated_at: NOW,
    },
  ],
  saasServiceProducts: [
    {
      id: "saas_service_product_full_color_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_full_color",
      inventory_item_id: "saas_item_tinte_dorado",
      quantity_per_service: 50,
      metadata: null,
    },
    {
      id: "saas_service_product_full_color_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_full_color",
      inventory_item_id: "saas_item_oxidante",
      quantity_per_service: 60,
      metadata: null,
    },
    {
      id: "saas_service_product_full_color_3",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_full_color",
      inventory_item_id: "saas_item_shampoo",
      quantity_per_service: 15,
      metadata: null,
    },
    {
      id: "saas_service_product_balayage_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_balayage",
      inventory_item_id: "saas_item_tinte_morado",
      quantity_per_service: 60,
      metadata: null,
    },
    {
      id: "saas_service_product_balayage_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_balayage",
      inventory_item_id: "saas_item_oxidante",
      quantity_per_service: 70,
      metadata: null,
    },
    {
      id: "saas_service_product_balayage_3",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_balayage",
      inventory_item_id: "saas_item_mask",
      quantity_per_service: 20,
      metadata: null,
    },
    {
      id: "saas_service_product_blow_dry_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_blow_dry",
      inventory_item_id: "saas_item_shampoo",
      quantity_per_service: 10,
      metadata: null,
    },
    {
      id: "saas_service_product_haircut_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      service_id: "saas_service_haircut_basic",
      inventory_item_id: "saas_item_gloves",
      quantity_per_service: 1,
      metadata: null,
    },
  ],
  saasSocialAccounts: [
    {
      id: "social_account_instagram_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      provider: "INSTAGRAM",
      handle: "@pelu_laura",
      display_name: "Peluqueria Laura",
      status: "CONNECTED_DEMO",
      auth_meta: JSON.stringify({ demo: true }),
      primary: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "social_account_tiktok_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      provider: "TIKTOK",
      handle: "@pelu_laura_hair",
      display_name: "Pelu Laura Hair",
      status: "CONNECTED_DEMO",
      auth_meta: JSON.stringify({ demo: true }),
      primary: 0,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasSocialCampaigns: [
    {
      id: "social_campaign_roots_monday",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Lunes sin raíces",
      objective: "FILL_AGENDA",
      status: "ACTIVE",
      target_segment: "INACTIVE_30D",
      start_date: NOW,
      end_date: null,
      budget_estimate: 120,
      notes: "Recuperar clientas que llevan más de 30 días sin visita.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "social_campaign_color_shine",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      name: "Color & Shine Weekend",
      objective: "SELL_PRODUCT",
      status: "DRAFT",
      target_segment: "ALL",
      start_date: NOW,
      end_date: null,
      budget_estimate: 180,
      notes: "Bundle de color + cuidado para fin de semana.",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasSocialPosts: [
    {
      id: "social_post_roots_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      campaign_id: "social_campaign_roots_monday",
      provider: "INSTAGRAM",
      content_type: "FEED",
      title: "Adiós raíces, hola brillo",
      body: "Lunes pensado para retocar color sin prisas y con extra de brillo.",
      image_hint: "antes/después en luz natural",
      status: "SCHEDULED",
      scheduled_at: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      posted_at: null,
      external_post_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "social_post_roots_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      campaign_id: "social_campaign_roots_monday",
      provider: "INSTAGRAM",
      content_type: "STORY",
      title: "Lunes sin raíces",
      body: "Reserva tu hueco rápido y mantén el tono perfecto.",
      image_hint: "detalle de raíz + producto",
      status: "DRAFT",
      scheduled_at: null,
      posted_at: null,
      external_post_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "social_post_color_shine_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      campaign_id: "social_campaign_color_shine",
      provider: "INSTAGRAM",
      content_type: "FEED",
      title: "Color morado sin destrozar tu pelo",
      body: "Glow intenso con tratamiento nutritivo incluido. Ideal para el finde.",
      image_hint: "antes/después en tonos violetas",
      status: "DRAFT",
      scheduled_at: null,
      posted_at: null,
      external_post_id: null,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasSocialMetrics: [
    {
      id: "social_metrics_demo_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      post_id: "social_post_roots_1",
      provider: "INSTAGRAM",
      impressions: 4200,
      likes: 240,
      comments: 18,
      shares: 12,
      clicks: 64,
      leads_generated: 4,
      captured_at: NOW,
      metadata: JSON.stringify({ source: "demo" }),
    },
  ],
  saasDomains: [
    {
      id: "saas_domain_demo_primary",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      domain: "peluqueria-demo.drako.test",
      is_primary: 1,
      status: "active",
      last_checked_at: NOW,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_domain_demo_secondary",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      domain: "demo-drako-peluqueria.localhost",
      is_primary: 0,
      status: "pending",
      last_checked_at: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasBlueprints: [
    {
      id: "saas_blueprint_demo_operativo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      business_type: "SALON",
      primary_goal: "FILL_AGENDA",
      maturity_stage: "GROWTH",
      notes: "Blueprint inicial para peluqueria demo.",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasModules: [
    {
      id: "saas_module_economy",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "ECONOMY",
      label: "Economy Engine",
      phase: 1,
      status: "ACTIVE",
      importance: 3,
      description: "Servicios, inventario, pricing y rentabilidad.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_hr",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "HR",
      label: "HR & Fairness",
      phase: 1,
      status: "ACTIVE",
      importance: 3,
      description: "Contratos, horarios y cumplimiento.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_appointments",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "APPOINTMENTS",
      label: "Appointments",
      phase: 1,
      status: "ACTIVE",
      importance: 3,
      description: "Agenda y flujo de citas.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_customers",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "CUSTOMERS",
      label: "Customers",
      phase: 1,
      status: "ACTIVE",
      importance: 2,
      description: "Clientes y perfiles.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_client_portal",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "CLIENT_PORTAL",
      label: "Client Portal",
      phase: 1,
      status: "ACTIVE",
      importance: 2,
      description: "Portal publico con booking.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_staff_portal",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "STAFF_PORTAL",
      label: "Staff Portal",
      phase: 1,
      status: "ACTIVE",
      importance: 2,
      description: "Panel operativo del equipo.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_email_intake",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "EMAIL_INTAKE",
      label: "Email Intake",
      phase: 2,
      status: "ACTIVE",
      importance: 2,
      description: "Facturas y ahorro en proveedores.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_social",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "SOCIAL",
      label: "Social Engine",
      phase: 2,
      status: "ACTIVE",
      importance: 2,
      description: "Campanas y conversion social.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_owner_control",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "OWNER_CONTROL",
      label: "Owner Control",
      phase: 2,
      status: "ACTIVE",
      importance: 3,
      description: "Snapshot ejecutivo.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_autopilot",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "AUTOPILOT",
      label: "Autopilot",
      phase: 3,
      status: "ACTIVE",
      importance: 3,
      description: "Playbook diario del owner.",
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_module_domains",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      code: "DOMAINS",
      label: "Domains",
      phase: 0,
      status: "ACTIVE",
      importance: 3,
      description: "Dominios publicos del SaaS.",
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasInterviewAnswers: [],
  saasFeatures: [
    {
      id: "saas_feature_economy",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "ECONOMY",
      label: "Economy Engine",
      category: "CORE",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_hr",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "HR",
      label: "HR & Compliance",
      category: "OPERATIONS",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_employees",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "EMPLOYEES",
      label: "Equipo & Roles",
      category: "OPERATIONS",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_staff_portal",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "STAFF_PORTAL",
      label: "Staff Portal",
      category: "OPERATIONS",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_client_portal",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "CLIENT_PORTAL",
      label: "Client Portal",
      category: "MARKETING",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_email_intake",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "EMAIL_INTAKE",
      label: "Email Intake",
      category: "MARKETING",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 2,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_social",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "SOCIAL",
      label: "Social Engine",
      category: "MARKETING",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 2,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_owner_control",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "OWNER_CONTROL",
      label: "Owner Control",
      category: "ANALYTICS",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 2,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_tax_engine",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "TAX_ENGINE",
      label: "Tax & Accounting",
      category: "ANALYTICS",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 2,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_tasks",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "TASKS",
      label: "Tasks & Execution",
      category: "OPERATIONS",
      status: "ENABLED",
      source: "AUTOPILOT",
      phase_order: 3,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_knowledge",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "KNOWLEDGE",
      label: "Knowledge Base",
      category: "OPERATIONS",
      status: "ENABLED",
      source: "MANUAL",
      phase_order: 3,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_blueprint",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "BLUEPRINT",
      label: "Blueprint & Factory",
      category: "CORE",
      status: "ENABLED",
      source: "BLUEPRINT",
      phase_order: 0,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "saas_feature_branding",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      feature_key: "APPEARANCE_BRANDING",
      label: "Branding & Themes",
      category: "CORE",
      status: "ENABLED",
      source: "MANUAL",
      phase_order: 0,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasBrandingSettings: [
    {
      id: "branding_demo_salon",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      primary_color: "#00bcd4",
      secondary_color: "#006064",
      accent_color: "#ffca28",
      background_color: "#0b0b0f",
      surface_color: "#12121a",
      text_color: "#f5f5f5",
      danger_color: "#ef5350",
      success_color: "#66bb6a",
      logo_url: "https://demo.drako/logo-salon.png",
      favicon_url: null,
      hero_image_url: "https://demo.drako/hero-salon.jpg",
      layout_density: "NORMAL",
      enable_dark_mode: 1,
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasUserUiPreferences: [
    {
      id: "prefs_owner_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      user_id: "owner_demo_core",
      role_type: "OWNER",
      layout_density_override: "NORMAL",
      default_section: "OWNER_CONTROL",
      hidden_widgets: JSON.stringify([]),
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "prefs_employee_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      user_id: "employee_demo_mario",
      role_type: "EMPLOYEE",
      layout_density_override: "COMPACT",
      default_section: "AGENDA",
      hidden_widgets: JSON.stringify(["SOCIAL_OVERVIEW_CARD"]),
      metadata: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasTasks: [
    {
      id: "task_demo_economy_pricing",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      title: "Revisar precios de Balayage",
      description: "El margen de Balayage está por debajo del objetivo. Ajusta precio o coste.",
      category: "ECONOMY",
      source: "AUTOPILOT",
      status: "OPEN",
      severity: "WARNING",
      assignee_employee_id: null,
      due_date: null,
      metadata: JSON.stringify({ autopilotKey: "pricing_margin_gap", serviceId: "service_balayage" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "task_demo_hr_contract",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      title: "Revisar contrato de Laura",
      description: "Horas al límite semanal. Ajusta agenda o contrato.",
      category: "HR",
      source: "AUTOPILOT",
      status: "OPEN",
      severity: "CRITICAL",
      assignee_employee_id: null,
      due_date: null,
      metadata: JSON.stringify({ autopilotKey: "fairness_overwork_detected", employeeId: "employee_demo_laura" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "task_demo_social_campaign",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      title: "Duplicar campaña Lunes sin raíces",
      description: "Replica la campaña para martes para aprovechar huecos.",
      category: "SOCIAL",
      source: "MANUAL_OWNER",
      status: "IN_PROGRESS",
      severity: "SUGGESTION",
      assignee_employee_id: null,
      due_date: null,
      metadata: JSON.stringify({ campaignId: "campaign_demo_lunes_sin_raices" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "task_demo_email_supplier",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      title: "Responder a proveedor ColorCo",
      description: "Enviar contraoferta de suministro de tinte.",
      category: "EMAIL",
      source: "MANUAL_STAFF",
      status: "OPEN",
      severity: "SUGGESTION",
      assignee_employee_id: "employee_demo_maria",
      due_date: null,
      metadata: JSON.stringify({ supplier: "ColorCo" }),
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasTaskEvents: [],
  knowledgeSpaces: [
    {
      id: "knowledge_space_operations",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "operations",
      label: "Operaciones diarias",
      description: "Protocolos y checklists del día a día.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "knowledge_space_color",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "color-techniques",
      label: "Técnicas de color",
      description: "Guías para servicios de color y balayage.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "knowledge_space_pricing",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "pricing",
      label: "Precios y ofertas",
      description: "Revisión de márgenes y promociones.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "knowledge_space_hr",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "hr",
      label: "RRHH & Fairness",
      description: "Políticas de descanso y límites de horas.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "knowledge_space_social",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      slug: "social-playbooks",
      label: "Redes sociales",
      description: "Playbooks para campañas y reseñas.",
      is_active: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  knowledgeDocuments: [
    {
      id: "knowledge_doc_first_visit",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_operations",
      title: "Checklist · Protocolos de primera visita",
      type: "CHECKLIST",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "STAFF",
      importance: "STANDARD",
      summary: "Checklist para la primera visita del cliente.",
      content:
        "- Confirmar preferencias\n- Foto de referencia\n- Registrar alergias\n- Proponer upgrade\n- Programar seguimiento",
      tags: JSON.stringify(["first-visit", "checklist"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ language: "es" }),
    },
    {
      id: "knowledge_doc_color_times",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_color",
      title: "Manual · Tiempos de exposición de color",
      type: "MANUAL",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "STAFF",
      importance: "STANDARD",
      summary: "Guía rápida de tiempos estándar.",
      content:
        "Cabello fino: 25-30 min\nCabello medio: 30-35 min\nCabello grueso: 35-40 min\nRevisar cada 10 min en decoloración.",
      tags: JSON.stringify(["color", "balayage", "tinte"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ language: "es" }),
    },
    {
      id: "knowledge_doc_noshow_script",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_operations",
      title: "Script · WhatsApp recordatorio + no-show",
      type: "SCRIPT",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "STAFF",
      importance: "INFO",
      summary: "Mensaje para recordatorio de cita y política no-show.",
      content:
        "Hola {cliente}, te recordamos tu cita mañana a las {hora}. Si necesitas reprogramar, avísanos con 24h de antelación. Gracias.",
      tags: JSON.stringify(["whatsapp", "no-show"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ channel: "whatsapp" }),
    },
    {
      id: "knowledge_doc_social_reviews",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_social",
      title: "Playbook · Responder reseñas negativas",
      type: "MANUAL",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "STAFF",
      importance: "STANDARD",
      summary: "Plantilla para responder reseñas negativas con calma.",
      content:
        "1) Agradecer feedback.\n2) Pedir disculpas si aplica.\n3) Ofrecer canal privado.\n4) Invitar a segunda oportunidad.",
      tags: JSON.stringify(["reviews", "social"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ channel: "google-maps" }),
    },
    {
      id: "knowledge_doc_pricing_review",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_pricing",
      title: "Guía · Revisión mensual de precios y márgenes",
      type: "MANUAL",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "OWNER",
      importance: "CRITICAL",
      summary: "Checklist mensual para ajustar precios.",
      content:
        "- Revisar servicios LOSS\n- Comparar margen vs objetivo\n- Ajustar precios sugeridos\n- Comunicar cambios",
      tags: JSON.stringify(["pricing", "margen"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ frequency: "monthly" }),
    },
    {
      id: "knowledge_doc_hr_policy",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_hr",
      title: "Policy · Límites de horas y descanso",
      type: "POLICY",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "OWNER",
      importance: "CRITICAL",
      summary: "Política de descanso y límites de horas según HR.",
      content:
        "Límite semanal: 40h (ajustable por contrato).\nDescanso mínimo entre turnos: 0-8h según settings.\nNo programar si se supera el límite con enforcement activo.",
      tags: JSON.stringify(["hr", "fairness", "guardrails"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ version: "1.0" }),
    },
    {
      id: "knowledge_doc_tax_quarter",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      space_id: "knowledge_space_pricing",
      title: "Guía · Cierre trimestral de IVA (demo)",
      type: "MANUAL",
      source: "SYSTEM",
      status: "ACTIVE",
      audience: "OWNER",
      importance: "CRITICAL",
      summary: "Checklist rápido para preparar el cierre trimestral.",
      content:
        "- Revisar ingresos y gastos del trimestre\n- Validar facturas con IVA\n- Estimar IVA a pagar\n- Reservar caja para el pago\n- Consultar gestor si hay dudas",
      tags: JSON.stringify(["tax", "iva", "quarterly"]),
      created_by_employee_id: null,
      created_at: NOW,
      updated_at: NOW,
      metadata: JSON.stringify({ language: "es", disclaimer: "demo" }),
    },
  ],
  knowledgeLinks: [
    {
      id: "knowledge_link_color_service",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      document_id: "knowledge_doc_color_times",
      target_type: "SERVICE",
      target_id: "service_full_color",
      created_at: NOW,
    },
    {
      id: "knowledge_link_balayage_service",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      document_id: "knowledge_doc_color_times",
      target_type: "SERVICE",
      target_id: "service_balayage",
      created_at: NOW,
    },
    {
      id: "knowledge_link_autopilot_noshow",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      document_id: "knowledge_doc_noshow_script",
      target_type: "AUTOPILOT_KEY",
      target_id: "general_recommendation",
      created_at: NOW,
    },
    {
      id: "knowledge_link_hr_role",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      document_id: "knowledge_doc_hr_policy",
      target_type: "ROLE",
      target_id: "stylist",
      created_at: NOW,
    },
    {
      id: "knowledge_link_tax_autopilot",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      document_id: "knowledge_doc_tax_quarter",
      target_type: "AUTOPILOT_KEY",
      target_id: "tax_high_due",
      created_at: NOW,
    },
  ],
  baselineNeeds: [],
  vendorExpenses: [],
  treasuryAccounts: [],
  treasuryMovements: [],
  saasMarketingPlans: [],
  saasMarketingUsage: [],
  saasPaidAdsSpend: [],
};

const EMPTY_STATE: DemoTenantState = {
  owner: null,
  clients: [],
  saas: [],
  clientSaas: [],
  clinicProfiles: [],
  clinicServices: [],
  clinicLeads: [],
  clinicAppointments: [],
  clinicReviews: [],
  clinicFinance: [],
  saasPlans: [],
  clientSaasSubscriptions: [],
  invoices: [],
  tickets: [],
  provisions: [],
  subscriptions: [],
  saasPlanFeatures: [],
  saasCustomers: [],
  saasCustomerProfiles: [],
  saasCustomerBookings: [],
  saasAppointments: [],
  saasCustomerMetrics: [],
  saasCustomerStyleNotes: [],
  saasEmailMessages: [],
  saasConversations: [
    {
      id: "conv_demo_whatsapp_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_laura_cliente",
      channel: "WHATSAPP",
      subject: "Cambio de hora para mañana",
      status: "OPEN",
      last_message_at: NOW,
      last_customer_message_at: NOW,
      last_staff_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 30).toISOString(),
      metadata: JSON.stringify({ threadType: "whatsapp", externalId: "wa_demo_001" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 90).toISOString(),
      updated_at: NOW,
    },
    {
      id: "conv_demo_instagram_lead",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: null,
      channel: "INSTAGRAM_DM",
      subject: "Campaña balayage primavera",
      status: "PENDING",
      last_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
      last_customer_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
      last_staff_message_at: null,
      metadata: JSON.stringify({ campaignId: "social_campaign_spring", handle: "@maria_color" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 45).toISOString(),
      updated_at: new Date(Date.parse(NOW) - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "conv_demo_email_quote",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      customer_id: "customer_carlos_cliente",
      channel: "EMAIL",
      subject: "Presupuesto pack cuidado masculino",
      status: "RESOLVED",
      last_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
      last_customer_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 300).toISOString(),
      last_staff_message_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
      metadata: JSON.stringify({ emailThreadId: "email_demo_001" }),
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 600).toISOString(),
      updated_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
    },
  ],
  saasConversationMessages: [
    {
      id: "conv_msg_demo_whatsapp_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: "customer_laura_cliente",
      employee_id: "employee_demo_mario",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "¡Hola Laura! Te esperamos mañana a las 10:00 con Mario.",
      provider_message_id: "wa_msg_owner_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 50).toISOString(),
    },
    {
      id: "conv_msg_demo_whatsapp_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: "customer_laura_cliente",
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "¿Podemos moverlo a las 11:00? Tengo reunión a las 9",
      provider_message_id: "wa_msg_customer_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 35).toISOString(),
    },
    {
      id: "conv_msg_demo_whatsapp_3",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_whatsapp_laura",
      customer_id: null,
      employee_id: "employee_demo_mario",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "¡Claro! Reprogramo para las 11:00. Te mando confirmación.",
      provider_message_id: "wa_msg_owner_002",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 32).toISOString(),
    },
    {
      id: "conv_msg_demo_instagram_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_instagram_lead",
      customer_id: null,
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "Hola! Vi su campaña de balayage, ¿qué precio tiene?",
      provider_message_id: "ig_msg_customer_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "conv_msg_demo_email_1",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_email_quote",
      customer_id: "customer_carlos_cliente",
      employee_id: null,
      sender_type: "CUSTOMER",
      direction: "INBOUND",
      body: "Hola equipo, ¿me podéis enviar presupuesto para el pack cuidado masculino?",
      provider_message_id: "email_demo_msg_001",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 310).toISOString(),
    },
    {
      id: "conv_msg_demo_email_2",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      conversation_id: "conv_demo_email_quote",
      customer_id: "customer_carlos_cliente",
      employee_id: "employee_demo_ana",
      sender_type: "STAFF",
      direction: "OUTBOUND",
      body: "Hola Carlos, el pack completo son 110€. Incluye corte, limpieza y masaje. ¿Quieres que te reserve?",
      provider_message_id: "email_demo_msg_002",
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 240).toISOString(),
    },
  ],
  saasNotifications: [
    {
      id: "notif_demo_new_lead",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: null,
      type: "EMAIL_LEAD",
      severity: "INFO",
      title: "Nuevo lead desde email",
      body: "Carlos Cliente solicitó presupuesto pack cuidado masculino.",
      related_entity_type: "CONVERSATION",
      related_entity_id: "conv_demo_email_quote",
      is_read: 0,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 200).toISOString(),
    },
    {
      id: "notif_demo_whatsapp_unread",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: "employee_demo_mario",
      type: "CONVERSATION_NEW_MESSAGE",
      severity: "WARNING",
      title: "Laura pidió mover su cita",
      body: "Revisa WhatsApp, queda pendiente confirmar la reprogramación.",
      related_entity_type: "CONVERSATION",
      related_entity_id: "conv_demo_whatsapp_laura",
      is_read: 0,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "notif_demo_social_alert",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      employee_id: null,
      type: "SOCIAL_CAMPAIGN_ALERT",
      severity: "INFO",
      title: "DM campaña balayage",
      body: "María preguntó precio desde Instagram. Dale respuesta rápida.",
      related_entity_type: "CONVERSATION",
      related_entity_id: "conv_demo_instagram_lead",
      is_read: 1,
      created_at: new Date(Date.parse(NOW) - 1000 * 60 * 18).toISOString(),
    },
  ],
  saasWhatsappIdentities: [
    {
      id: "wa_identity_owner_demo",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "SAAS_OWNER",
      actor_id: "owner_demo_core",
      phone_number: "+34 600 000 000",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS", "TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Owner demo" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_employee_mario",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_mario",
      phone_number: "+34 666 111 111",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ role: "color" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_employee_ana",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_ana",
      phone_number: "+34 666 222 222",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["TASKS", "ALERTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ role: "recepcion" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_customer_laura",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      phone_number: "+34 600 111 222",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Laura Cliente" }),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: "wa_identity_customer_carlos",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      actor_type: "CUSTOMER",
      actor_id: "customer_carlos_cliente",
      phone_number: "+34 600 333 444",
      preferred_language: "es",
      allowed_channels: JSON.stringify(["APPOINTMENTS"]),
      consent_flags: JSON.stringify(["BASIC"]),
      metadata: JSON.stringify({ label: "Carlos Cliente" }),
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  saasWhatsappMessages: [
    {
      id: "wa_msg_demo_inbound_customer",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 111 222",
      direction: "INBOUND",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "mis citas hoy",
      intent: "SHOW_APPOINTMENTS_TODAY",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_outbound_customer",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 111 222",
      direction: "OUTBOUND",
      actor_type: "CUSTOMER",
      actor_id: "customer_laura_cliente",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "Hoy tienes cita a las 10:00.",
      intent: "SHOW_APPOINTMENTS_TODAY",
      status: "SENT",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_inbound_employee",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 666 111 111",
      direction: "INBOUND",
      actor_type: "EMPLOYEE",
      actor_id: "employee_demo_mario",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "agenda hoy",
      intent: "SHOW_TODAY_SCHEDULE",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
    {
      id: "wa_msg_demo_inbound_owner",
      tenant_id: DEMO_TENANT_ID,
      saas_id: "saas_demo_operativo",
      phone_number: "+34 600 000 000",
      direction: "INBOUND",
      actor_type: "SAAS_OWNER",
      actor_id: "owner_demo_core",
      conversation_id: "conv_demo_whatsapp_laura",
      body: "resumen hoy",
      intent: "SHOW_DAILY_SUMMARY",
      status: "RECEIVED",
      provider_message_id: null,
      metadata: JSON.stringify({ demo: true }),
      created_at: NOW,
    },
  ],
  saasTaxProfiles: [],
  saasTaxPeriods: [],
  employeeRoles: [],
  employees: [],
  employeeSkills: [],
  employeeSchedules: [],
  employeeContracts: [],
  employeeHrFlags: [],
  employeeTimesheets: [],
  employeePayrollRuns: [],
  employeeHrEvents: [],
  hrRules: [],
  hrSettings: [],
  saasServices: [],
  saasInventoryItems: [],
  saasInventoryMovements: [],
  saasExpenses: [],
  saasPricingSettings: [],
  saasServiceProducts: [],
  saasSocialAccounts: [],
  saasSocialCampaigns: [],
  saasSocialPosts: [],
  saasSocialMetrics: [],
  saasDomains: [],
  saasBlueprints: [],
  saasModules: [],
  saasInterviewAnswers: [],
  saasFeatures: [],
  saasBrandingSettings: [],
  saasUserUiPreferences: [],
  saasTasks: [],
  saasTaskEvents: [],
  knowledgeSpaces: [],
  knowledgeDocuments: [],
  knowledgeLinks: [],
  baselineNeeds: [],
  vendorExpenses: [],
  treasuryAccounts: [],
  treasuryMovements: [],
  saasMarketingPlans: [],
  saasMarketingUsage: [],
  saasPaidAdsSpend: [],
};

function cloneState(state: DemoTenantState): DemoTenantState {
  return {
    owner: state.owner ? { ...state.owner } : null,
    clients: state.clients.map((item) => ({ ...item })),
    saas: state.saas.map((item) => ({ ...item })),
    clientSaas: state.clientSaas.map((item) => ({ ...item })),
    clinicProfiles: state.clinicProfiles.map((item) => ({ ...item })),
    clinicServices: state.clinicServices.map((item) => ({ ...item })),
    clinicLeads: state.clinicLeads.map((item) => ({ ...item })),
    clinicAppointments: state.clinicAppointments.map((item) => ({ ...item })),
    clinicReviews: state.clinicReviews.map((item) => ({ ...item })),
    clinicFinance: state.clinicFinance.map((item) => ({ ...item })),
    saasPlans: state.saasPlans.map((item) => ({ ...item })),
    clientSaasSubscriptions: state.clientSaasSubscriptions.map((item) => ({ ...item })),
    invoices: state.invoices.map((item) => ({ ...item })),
    tickets: state.tickets.map((item) => ({ ...item })),
    provisions: state.provisions.map((item) => ({ ...item })),
    subscriptions: state.subscriptions.map((item) => ({ ...item })),
    saasCustomers: state.saasCustomers.map((item) => ({ ...item })),
    saasCustomerProfiles: state.saasCustomerProfiles.map((item) => ({ ...item })),
    saasCustomerBookings: state.saasCustomerBookings.map((item) => ({ ...item })),
    saasAppointments: state.saasAppointments.map((item) => ({ ...item })),
    saasCustomerMetrics: state.saasCustomerMetrics.map((item) => ({ ...item })),
    saasCustomerStyleNotes: state.saasCustomerStyleNotes.map((item) => ({ ...item })),
    saasEmailMessages: state.saasEmailMessages.map((item) => ({ ...item })),
    saasConversations: state.saasConversations.map((item) => ({ ...item })),
    saasConversationMessages: state.saasConversationMessages.map((item) => ({ ...item })),
    saasNotifications: state.saasNotifications.map((item) => ({ ...item })),
    saasWhatsappIdentities: state.saasWhatsappIdentities.map((item) => ({ ...item })),
    saasWhatsappMessages: state.saasWhatsappMessages.map((item) => ({ ...item })),
    saasTaxProfiles: state.saasTaxProfiles.map((item) => ({ ...item })),
    saasTaxPeriods: state.saasTaxPeriods.map((item) => ({ ...item })),
    employeeRoles: state.employeeRoles.map((item) => ({ ...item })),
    employees: state.employees.map((item) => ({ ...item })),
    employeeSkills: state.employeeSkills.map((item) => ({ ...item })),
    employeeSchedules: state.employeeSchedules.map((item) => ({ ...item })),
    employeeContracts: state.employeeContracts.map((item) => ({ ...item })),
    employeeHrFlags: state.employeeHrFlags.map((item) => ({ ...item })),
    employeeTimesheets: state.employeeTimesheets.map((item) => ({ ...item })),
    employeePayrollRuns: state.employeePayrollRuns.map((item) => ({ ...item })),
    employeeHrEvents: state.employeeHrEvents.map((item) => ({ ...item })),
    hrRules: state.hrRules.map((item) => ({ ...item })),
    hrSettings: state.hrSettings.map((item) => ({ ...item })),
    saasServices: state.saasServices.map((item) => ({ ...item })),
    saasInventoryItems: state.saasInventoryItems.map((item) => ({ ...item })),
    saasInventoryMovements: state.saasInventoryMovements.map((item) => ({ ...item })),
    saasExpenses: state.saasExpenses.map((item) => ({ ...item })),
    saasPricingSettings: state.saasPricingSettings.map((item) => ({ ...item })),
    saasServiceProducts: state.saasServiceProducts.map((item) => ({ ...item })),
    saasSocialAccounts: state.saasSocialAccounts.map((item) => ({ ...item })),
    saasSocialCampaigns: state.saasSocialCampaigns.map((item) => ({ ...item })),
    saasSocialPosts: state.saasSocialPosts.map((item) => ({ ...item })),
    saasSocialMetrics: state.saasSocialMetrics.map((item) => ({ ...item })),
    saasDomains: state.saasDomains.map((item) => ({ ...item })),
    saasPlanFeatures: state.saasPlanFeatures.map((item) => ({ ...item })),
    saasBlueprints: state.saasBlueprints.map((item) => ({ ...item })),
    saasModules: state.saasModules.map((item) => ({ ...item })),
    saasInterviewAnswers: state.saasInterviewAnswers.map((item) => ({ ...item })),
    saasFeatures: state.saasFeatures.map((item) => ({ ...item })),
    saasBrandingSettings: state.saasBrandingSettings.map((item) => ({ ...item })),
    saasUserUiPreferences: state.saasUserUiPreferences.map((item) => ({ ...item })),
    saasTasks: state.saasTasks.map((item) => ({ ...item })),
    saasTaskEvents: state.saasTaskEvents.map((item) => ({ ...item })),
    knowledgeSpaces: state.knowledgeSpaces.map((item) => ({ ...item })),
    knowledgeDocuments: state.knowledgeDocuments.map((item) => ({ ...item })),
    knowledgeLinks: state.knowledgeLinks.map((item) => ({ ...item })),
    baselineNeeds: state.baselineNeeds.map((item) => ({ ...item })),
    vendorExpenses: state.vendorExpenses.map((item) => ({ ...item })),
    treasuryAccounts: state.treasuryAccounts.map((item) => ({ ...item })),
    treasuryMovements: state.treasuryMovements.map((item) => ({ ...item })),
    saasMarketingPlans: state.saasMarketingPlans.map((item) => ({ ...item })),
    saasMarketingUsage: state.saasMarketingUsage.map((item) => ({ ...item })),
    saasPaidAdsSpend: state.saasPaidAdsSpend.map((item) => ({ ...item })),
  };
}

function getExternalDemoTenantState(tenantId: string): DemoTenantStateSnapshot | null {
  if (typeof externalDemoTenantStateCache === "undefined") {
    externalDemoTenantStateCache = new Map();
    const raw =
      typeof process !== "undefined" && process.env
        ? process.env.DRAKO_SOCIALFLOW_DEMO_STATE
        : undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { tenants?: Record<string, DemoTenantStateSnapshot> };
        const tenants = parsed?.tenants ?? {};
        for (const [id, state] of Object.entries(tenants)) {
          if (!state) continue;
          externalDemoTenantStateCache.set(id, cloneState(state));
        }
      } catch (error) {
        console.warn("SOCIALFLOW_DEMO_STATE_PARSE_FAILED", error);
      }
    }
  }

  const record = externalDemoTenantStateCache?.get(tenantId);
  return record ? cloneState(record) : null;
}

function ensureTenantState(tenantId: string): DemoTenantState {
  const existing = tenantStore.get(tenantId);
  if (existing) return existing;
  const external = getExternalDemoTenantState(tenantId);
  const base = tenantId === DEMO_TENANT_ID ? DEFAULT_STATE : EMPTY_STATE;
  const cloned = external ? cloneState(external) : cloneState(base);

  // In Node dev, merge any persisted SocialFlow demo snapshot for this tenant
  if (isNodeDev) {
    const snapshot = loadSocialflowDemoSnapshot();
    const snapTenant = snapshot?.tenants?.[tenantId];
    if (snapTenant) {
      if (Array.isArray(snapTenant.saasSocialAccounts)) {
        cloned.saasSocialAccounts = snapTenant.saasSocialAccounts;
      }
      if (Array.isArray(snapTenant.saasSocialCampaigns)) {
        cloned.saasSocialCampaigns = snapTenant.saasSocialCampaigns;
      }
      if (Array.isArray(snapTenant.saasSocialPosts)) {
        cloned.saasSocialPosts = snapTenant.saasSocialPosts;
      }
      if (Array.isArray(snapTenant.saasSocialMetrics)) {
        cloned.saasSocialMetrics = snapTenant.saasSocialMetrics;
      }
    }
  }

  tenantStore.set(tenantId, cloned);
  return cloned;
}

function generateId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `${prefix}_${random}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
}

export function getDemoOwner(tenantId: string): DemoOwner | null {
  const owner = ensureTenantState(tenantId).owner;
  return owner ? { ...owner } : null;
}

export function __resetDemoTenantStateForDev(tenantId?: string): DemoTenantStateSnapshot {
  if (!tenantId) {
    tenantStore.clear();
    return cloneState(EMPTY_STATE);
  }
  const cleared = ensureTenantState(tenantId);
  tenantStore.delete(tenantId);
  return cloneState(cleared);
}

export function exportDemoTenantState(tenantId: string): DemoTenantStateSnapshot {
  return cloneState(ensureTenantState(tenantId));
}

export function replaceDemoTenantState(tenantId: string, state: DemoTenantStateSnapshot): DemoTenantStateSnapshot {
  const cloned = cloneState(state);
  tenantStore.set(tenantId, cloned);
  return cloneState(cloned);
}

export function upsertDemoOwner(tenantId: string, payload: Partial<DemoOwner>): DemoOwner {
  const state = ensureTenantState(tenantId);
  if (!payload.name?.trim() && !state.owner) {
    throw new Error("name is required");
  }
  const now = new Date().toISOString();
  const base: DemoOwner =
    state.owner ??
    ({
      id: generateId("owner"),
      name: payload.name?.trim() ?? "Owner",
      nif: payload.nif ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      country: payload.country ?? "Spain",
      city: payload.city ?? "Barcelona",
      address: payload.address ?? null,
      created_at: now,
    } satisfies DemoOwner);
  const updated: DemoOwner = {
    ...base,
    ...payload,
    name: (payload.name ?? base.name).trim(),
    nif: typeof payload.nif === "undefined" ? base.nif : payload.nif,
    email: typeof payload.email === "undefined" ? base.email : payload.email,
    phone: typeof payload.phone === "undefined" ? base.phone : payload.phone,
    country: typeof payload.country === "undefined" ? base.country : payload.country,
    city: typeof payload.city === "undefined" ? base.city : payload.city,
    address: typeof payload.address === "undefined" ? base.address : payload.address,
  };
  if (!state.owner) {
    updated.created_at = now;
  }
  state.owner = updated;
  return { ...updated };
}

export function listDemoClients(tenantId: string): DemoClient[] {
  return ensureTenantState(tenantId).clients.map((client) => ({ ...client }));
}

export function upsertDemoClient(tenantId: string, payload: Partial<DemoClient>): DemoClient {
  const state = ensureTenantState(tenantId);
  const ownerId = payload.owner_id ?? state.owner?.id ?? "owner_demo_core";
  const existing = payload.id ? state.clients.find((client) => client.id === payload.id) : null;
  const now = new Date().toISOString();
  if (existing) {
    if (typeof payload.name === "string" && payload.name.trim().length > 0) {
      existing.name = payload.name.trim();
    }
    existing.owner_id = payload.owner_id ?? existing.owner_id;
    if (typeof payload.nif !== "undefined") existing.nif = payload.nif;
    if (typeof payload.email !== "undefined") existing.email = payload.email;
    if (typeof payload.phone !== "undefined") existing.phone = payload.phone;
    if (typeof payload.country !== "undefined") existing.country = payload.country;
    if (typeof payload.city !== "undefined") existing.city = payload.city;
    if (typeof payload.address !== "undefined") existing.address = payload.address;
    return { ...existing };
  }
  const name = payload.name?.trim();
  if (!name) {
    throw new Error("name is required");
  }
  const created: DemoClient = {
    id: payload.id?.trim() ?? generateId("client"),
    owner_id: ownerId,
    name,
    nif: payload.nif ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    country: payload.country ?? "Spain",
    city: payload.city ?? "Barcelona",
    address: payload.address ?? null,
    created_at: now,
  };
  state.clients.push(created);
  return { ...created };
}

export function listDemoSaas(tenantId: string): DemoSaas[] {
  return ensureTenantState(tenantId).saas.map((item) => ({ ...item }));
}

export function upsertDemoSaas(tenantId: string, payload: Partial<DemoSaas>): DemoSaas {
  const state = ensureTenantState(tenantId);
  const existing = payload.id ? state.saas.find((item) => item.id === payload.id) : null;
  const now = new Date().toISOString();
  if (existing) {
    if (typeof payload.name === "string" && payload.name.trim().length > 0) {
      existing.name = payload.name.trim();
    }
    if (typeof payload.slug === "string" && payload.slug.trim().length > 0) {
      existing.slug = payload.slug.trim();
    }
    if (typeof payload.domain !== "undefined") existing.domain = payload.domain;
    if (typeof payload.subdomain !== "undefined") existing.subdomain = payload.subdomain;
    if (typeof payload.status !== "undefined") existing.status = payload.status;
    if (typeof payload.public_domain !== "undefined") existing.public_domain = payload.public_domain;
    if (typeof payload.public_subdomain !== "undefined") existing.public_subdomain = payload.public_subdomain;
    if (typeof payload.domain_status !== "undefined") existing.domain_status = payload.domain_status;
    return { ...existing };
  }
  const name = payload.name?.trim();
  const slug = payload.slug?.trim();
  if (!name || !slug) {
    throw new Error("name and slug are required");
  }
  const created: DemoSaas = {
    id: payload.id?.trim() ?? generateId("saas"),
    name,
    slug,
    domain: payload.domain ?? null,
    subdomain: payload.subdomain ?? null,
    status: payload.status ?? "inactive",
    public_domain: payload.public_domain ?? null,
    public_subdomain: payload.public_subdomain ?? null,
    domain_status: payload.domain_status ?? "unconfigured",
    created_at: now,
  };
  state.saas.push(created);
  return { ...created };
}

export function listDemoClientSaas(tenantId: string): DemoClientSaas[] {
  return ensureTenantState(tenantId).clientSaas.map((item) => ({ ...item }));
}

export function addDemoClientSaas(
  tenantId: string,
  payload: { client_id: string; saas_id: string; status?: string; plan?: string | null; id?: string },
): DemoClientSaas {
  const state = ensureTenantState(tenantId);
  const record: DemoClientSaas = {
    id: payload.id?.trim() ?? generateId("link"),
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    status: payload.status ?? "active",
    plan: typeof payload.plan === "undefined" ? "standard" : payload.plan,
    created_at: new Date().toISOString(),
  };
  state.clientSaas.push(record);
  return { ...record };
}

export function updateDemoClientSaas(
  tenantId: string,
  payload: { id: string; status?: string; plan?: string | null; client_id?: string; saas_id?: string },
): DemoClientSaas | null {
  const state = ensureTenantState(tenantId);
  const record = state.clientSaas.find((item) => item.id === payload.id);
  if (!record) return null;
  if (typeof payload.client_id !== "undefined") record.client_id = payload.client_id;
  if (typeof payload.saas_id !== "undefined") record.saas_id = payload.saas_id;
  if (typeof payload.status !== "undefined") record.status = payload.status;
  if (typeof payload.plan !== "undefined") record.plan = payload.plan;
  return { ...record };
}

export function deleteDemoClientSaas(tenantId: string, id: string): boolean {
  const state = ensureTenantState(tenantId);
  const index = state.clientSaas.findIndex((item) => item.id === id);
  if (index === -1) return false;
  state.clientSaas.splice(index, 1);
  return true;
}

export function listDemoSaasPlans(tenantId: string): DemoSaasPlan[] {
  return ensureTenantState(tenantId).saasPlans.map((item) => ({ ...item }));
}

export function getDemoSaasPackForSaas(saasId: string): SaasPackDefinition | null {
  if (saasId === "saas_demo_operativo") {
    return SAAS_PACK_DEFINITIONS.find((pack) => pack.id === "drako_salon_pack") ?? null;
  }
  if (saasId === "saas_demo_lanzamiento") {
    return SAAS_PACK_DEFINITIONS.find((pack) => pack.id === "drako_clinic_pack") ?? null;
  }
  return null;
}

export function listDemoSaasPlanFeatures(tenantId: string, planId: string): DemoSaasPlanFeature[] {
  return ensureTenantState(tenantId).saasPlanFeatures.filter((item) => item.plan_id === planId).map((item) => ({ ...item }));
}

export function upsertDemoSaasPlanFeature(
  tenantId: string,
  payload: Omit<DemoSaasPlanFeature, "created_at" | "updated_at"> & { id?: string },
): DemoSaasPlanFeature {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("plan_feature");
  const index = state.saasPlanFeatures.findIndex(
    (item) => item.id === id || (item.plan_id === payload.plan_id && item.feature_key === payload.feature_key),
  );
  const record: DemoSaasPlanFeature = {
    id,
    plan_id: payload.plan_id,
    feature_key: payload.feature_key,
    created_at: index >= 0 ? state.saasPlanFeatures[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasPlanFeatures[index] = record;
  } else {
    state.saasPlanFeatures.push(record);
  }
  return { ...record };
}

export function findDemoSaasPlanById(tenantId: string, planId: string): DemoSaasPlan | null {
  const plan = ensureTenantState(tenantId).saasPlans.find((item) => item.id === planId);
  return plan ? { ...plan } : null;
}

export function findDemoSaasPlanByCode(tenantId: string, saasId: string, planCode: string): DemoSaasPlan | null {
  const plan = ensureTenantState(tenantId).saasPlans.find((item) => item.saas_id === saasId && item.plan_code === planCode);
  return plan ? { ...plan } : null;
}

export function listDemoClientSaasSubscriptions(tenantId: string): DemoClientSaasSubscription[] {
  return ensureTenantState(tenantId).clientSaasSubscriptions.map((item) => ({ ...item }));
}

export function listDemoClientSaasSubscriptionsByClient(tenantId: string, clientId: string): DemoClientSaasSubscription[] {
  return ensureTenantState(tenantId).clientSaasSubscriptions
    .filter((item) => item.client_id === clientId)
    .map((item) => ({ ...item }));
}

export function listDemoClientSaasSubscriptionsBySaas(tenantId: string, saasId: string): DemoClientSaasSubscription[] {
  return ensureTenantState(tenantId).clientSaasSubscriptions
    .filter((item) => item.saas_id === saasId)
    .map((item) => ({ ...item }));
}

export function listDemoEmployees(tenantId: string, saasId?: string | null): DemoEmployee[] {
  const all = ensureTenantState(tenantId).employees;
  return all.filter((emp) => (saasId ? emp.saas_id === saasId : true)).map((emp) => ({ ...emp }));
}

export function listDemoEmployeeRoles(tenantId: string, saasId?: string | null): DemoEmployeeRole[] {
  const all = ensureTenantState(tenantId).employeeRoles;
  return all.filter((role) => (saasId ? role.saas_id === saasId : true)).map((role) => ({ ...role }));
}

export function getDemoEmployee(tenantId: string, employeeId: string): DemoEmployee | null {
  const employee = ensureTenantState(tenantId).employees.find((emp) => emp.id === employeeId);
  return employee ? { ...employee } : null;
}

export function upsertDemoEmployee(tenantId: string, payload: Partial<DemoEmployee>): DemoEmployee {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const existing = payload.id ? state.employees.find((emp) => emp.id === payload.id) : null;
  if (existing) {
    if (typeof payload.full_name === "string" && payload.full_name.trim().length > 0) existing.full_name = payload.full_name.trim();
    if (typeof payload.email !== "undefined") existing.email = payload.email;
    if (typeof payload.phone !== "undefined") existing.phone = payload.phone;
    if (typeof payload.role !== "undefined") existing.role = payload.role;
    if (typeof payload.avatar_url !== "undefined") existing.avatar_url = payload.avatar_url;
    if (typeof payload.notes !== "undefined") existing.notes = payload.notes;
    if (typeof payload.is_active === "number") existing.is_active = payload.is_active;
    existing.updated_at = now;
    return { ...existing };
  }
  if (!payload.full_name || !payload.saas_id) {
    throw new Error("full_name and saas_id are required");
  }
  const created: DemoEmployee = {
    id: payload.id?.trim() ?? generateId("employee"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    full_name: payload.full_name.trim(),
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    role: payload.role ?? null,
    avatar_url: payload.avatar_url ?? null,
    notes: payload.notes ?? null,
    is_active: typeof payload.is_active === "number" ? payload.is_active : 1,
    created_at: now,
    updated_at: now,
  };
  state.employees.push(created);
  return { ...created };
}

export function listDemoEmployeeSkills(tenantId: string, employeeId: string): DemoEmployeeSkill[] {
  return ensureTenantState(tenantId).employeeSkills.filter((item) => item.employee_id === employeeId).map((item) => ({ ...item }));
}

export function addDemoEmployeeSkill(
  tenantId: string,
  payload: Omit<DemoEmployeeSkill, "id" | "created_at" | "tenant_id"> & { id?: string },
): DemoEmployeeSkill {
  const record: DemoEmployeeSkill = {
    id: payload.id?.trim() ?? generateId("emp_skill"),
    tenant_id: tenantId,
    employee_id: payload.employee_id,
    skill: payload.skill,
    level: payload.level,
    created_at: new Date().toISOString(),
  };
  ensureTenantState(tenantId).employeeSkills.push(record);
  return { ...record };
}

export function listDemoEmployeeSchedules(tenantId: string, employeeId: string): DemoEmployeeSchedule[] {
  return ensureTenantState(tenantId).employeeSchedules.filter((item) => item.employee_id === employeeId).map((item) => ({ ...item }));
}

export function listDemoEmployeeContracts(tenantId: string, saasId?: string | null): DemoEmployeeContract[] {
  return ensureTenantState(tenantId)
    .employeeContracts.filter((item) => (saasId ? item.saas_id === saasId : true))
    .map((item) => ({ ...item }));
}

export function addDemoEmployeeSchedule(
  tenantId: string,
  payload: Omit<DemoEmployeeSchedule, "id" | "tenant_id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
): DemoEmployeeSchedule {
  const record: DemoEmployeeSchedule = {
    id: payload.id?.trim() ?? generateId("emp_sched"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    employee_id: payload.employee_id,
    day_of_week: payload.day_of_week,
    start_time: payload.start_time,
    end_time: payload.end_time,
    break_minutes: typeof payload.break_minutes === "number" ? payload.break_minutes : 0,
    created_at: payload.created_at ?? new Date().toISOString(),
    updated_at: payload.updated_at ?? new Date().toISOString(),
  };
  ensureTenantState(tenantId).employeeSchedules.push(record);
  return { ...record };
}

export function getDemoEmployeeContract(tenantId: string, saasId: string | null, employeeId: string): DemoEmployeeContract | null {
  const contract = ensureTenantState(tenantId).employeeContracts.find(
    (item) => item.employee_id === employeeId && (!saasId || item.saas_id === saasId) && item.is_active === 1,
  );
  return contract ? { ...contract } : null;
}

export function upsertDemoEmployeeContract(
  tenantId: string,
  payload: Omit<DemoEmployeeContract, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoEmployeeContract {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("emp_contract");
  const existingIndex = state.employeeContracts.findIndex((item) => item.id === id);
  const record: DemoEmployeeContract = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    employee_id: payload.employee_id,
    contract_type: payload.contract_type,
    base_salary_monthly: payload.base_salary_monthly ?? null,
    hourly_rate: payload.hourly_rate ?? null,
    commission_percent: payload.commission_percent ?? null,
    max_hours_week: payload.max_hours_week ?? null,
    min_hours_week: payload.min_hours_week ?? null,
    start_date: payload.start_date,
    end_date: payload.end_date ?? null,
    is_active: payload.is_active ?? 1,
    created_at: existingIndex >= 0 ? state.employeeContracts[existingIndex].created_at : now,
    updated_at: now,
  };
  if (existingIndex >= 0) {
    state.employeeContracts[existingIndex] = record;
  } else {
    state.employeeContracts.push(record);
  }
  return { ...record };
}

export function listDemoEmployeeTimesheets(
  tenantId: string,
  employeeId: string,
  period?: { start?: string; end?: string },
): DemoEmployeeTimesheet[] {
  const startTs = period?.start ? new Date(period.start).getTime() : null;
  const endTs = period?.end ? new Date(period.end).getTime() : null;
  return ensureTenantState(tenantId)
    .employeeTimesheets.filter((item) => {
      if (item.employee_id !== employeeId) return false;
      const timestamp = new Date(item.date).getTime();
      if (startTs && timestamp < startTs) return false;
      if (endTs && timestamp > endTs) return false;
      return true;
    })
    .map((item) => ({ ...item }));
}

export function upsertDemoEmployeeTimesheet(
  tenantId: string,
  payload: Omit<DemoEmployeeTimesheet, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoEmployeeTimesheet {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("emp_timesheet");
  const index = state.employeeTimesheets.findIndex((item) => item.id === id);
  const record: DemoEmployeeTimesheet = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    employee_id: payload.employee_id,
    date: payload.date,
    scheduled_minutes: payload.scheduled_minutes,
    worked_minutes: payload.worked_minutes,
    extra_minutes: payload.extra_minutes,
    late_minutes: payload.late_minutes,
    break_minutes: payload.break_minutes,
    source: payload.source,
    created_at: index >= 0 ? state.employeeTimesheets[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.employeeTimesheets[index] = record;
  } else {
    state.employeeTimesheets.push(record);
  }
  return { ...record };
}

export function listDemoEmployeePayrollRuns(
  tenantId: string,
  employeeId: string,
  period?: { start?: string; end?: string },
): DemoEmployeePayrollRun[] {
  const startTs = period?.start ? new Date(period.start).getTime() : null;
  const endTs = period?.end ? new Date(period.end).getTime() : null;
  return ensureTenantState(tenantId)
    .employeePayrollRuns.filter((item) => {
      if (item.employee_id !== employeeId) return false;
      const timestamp = new Date(item.period_start).getTime();
      if (startTs && timestamp < startTs) return false;
      if (endTs && timestamp > endTs) return false;
      return true;
    })
    .map((item) => ({ ...item }));
}

export function upsertDemoEmployeePayrollRun(
  tenantId: string,
  payload: Omit<DemoEmployeePayrollRun, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoEmployeePayrollRun {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("emp_payroll");
  const index = state.employeePayrollRuns.findIndex((item) => item.id === id);
  const record: DemoEmployeePayrollRun = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    employee_id: payload.employee_id,
    period_start: payload.period_start,
    period_end: payload.period_end,
    base_gross_amount: payload.base_gross_amount,
    overtime_amount: payload.overtime_amount,
    commission_amount: payload.commission_amount,
    other_adjustments: payload.other_adjustments,
    total_gross_amount: payload.total_gross_amount,
    status: payload.status,
    notes: payload.notes ?? null,
    created_at: index >= 0 ? state.employeePayrollRuns[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.employeePayrollRuns[index] = record;
  } else {
    state.employeePayrollRuns.push(record);
  }
  return { ...record };
}

export function listDemoEmployeeHrEvents(
  tenantId: string,
  employeeId: string,
  filters?: { limit?: number },
): DemoEmployeeHrEvent[] {
  const events = ensureTenantState(tenantId)
    .employeeHrEvents.filter((item) => item.employee_id === employeeId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (typeof filters?.limit === "number" ? events.slice(0, filters.limit) : events).map((item) => ({ ...item }));
}

export function appendDemoEmployeeHrEvent(
  tenantId: string,
  payload: Omit<DemoEmployeeHrEvent, "tenant_id" | "id" | "created_at"> & { id?: string; created_at?: string },
): DemoEmployeeHrEvent {
  const record: DemoEmployeeHrEvent = {
    id: payload.id?.trim() ?? generateId("emp_hr_event"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    employee_id: payload.employee_id,
    event_type: payload.event_type,
    severity: payload.severity,
    message: payload.message,
    created_by: payload.created_by,
    created_at: payload.created_at ?? new Date().toISOString(),
  };
  ensureTenantState(tenantId).employeeHrEvents.push(record);
  return { ...record };
}

export function getDemoHrRules(tenantId: string, saasId: string): DemoHrRules | null {
  const record = ensureTenantState(tenantId).hrRules.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function listDemoEmployeeHrFlags(tenantId: string, saasId?: string | null): DemoEmployeeHrFlag[] {
  return ensureTenantState(tenantId)
    .employeeHrFlags.filter((item) => (saasId ? item.saas_id === saasId : true))
    .map((item) => ({ ...item }));
}

export function getDemoEmployeeHrFlag(tenantId: string, employeeId: string): DemoEmployeeHrFlag | null {
  const record = ensureTenantState(tenantId).employeeHrFlags.find((item) => item.employee_id === employeeId);
  return record ? { ...record } : null;
}

export function getDemoHrSettings(tenantId: string, saasId: string): DemoHrSettings | null {
  const record = ensureTenantState(tenantId).hrSettings.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function upsertDemoHrSettings(
  tenantId: string,
  payload: Omit<DemoHrSettings, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoHrSettings {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("hr_settings");
  const index = state.hrSettings.findIndex((item) => item.id === id || (item.saas_id === payload.saas_id && item.tenant_id === tenantId));
  const record: DemoHrSettings = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    min_hourly_wage: typeof payload.min_hourly_wage === "number" ? payload.min_hourly_wage : null,
    max_weekly_hours: typeof payload.max_weekly_hours === "number" ? payload.max_weekly_hours : null,
    low_activity_appointments: typeof payload.low_activity_appointments === "number" ? payload.low_activity_appointments : null,
    block_overwork: typeof payload.block_overwork === "number" ? payload.block_overwork : 1,
    block_underpay: typeof payload.block_underpay === "number" ? payload.block_underpay : 0,
    min_rest_hours_between_shifts:
      typeof payload.min_rest_hours_between_shifts === "number" ? payload.min_rest_hours_between_shifts : 0,
    created_at: index >= 0 ? state.hrSettings[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.hrSettings[index] = record;
  } else {
    state.hrSettings.push(record);
  }
  return { ...record };
}

export function upsertDemoHrRules(
  tenantId: string,
  payload: Omit<DemoHrRules, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoHrRules {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("hr_rules");
  const index = state.hrRules.findIndex((item) => item.id === id || (item.saas_id === payload.saas_id && tenantId === item.tenant_id));
  const record: DemoHrRules = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    min_wage_hour: payload.min_wage_hour,
    max_hours_per_week_legal: payload.max_hours_per_week_legal,
    max_overtime_per_week: payload.max_overtime_per_week,
    min_rest_hours_between_shifts: payload.min_rest_hours_between_shifts,
    vacation_days_per_year: payload.vacation_days_per_year,
    block_illegal_overtime: payload.block_illegal_overtime,
    block_illegal_wage: payload.block_illegal_wage,
    created_at: index >= 0 ? state.hrRules[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.hrRules[index] = record;
  } else {
    state.hrRules.push(record);
  }
  return { ...record };
}

export function upsertDemoClientSaasSubscription(
  tenantId: string,
  payload: {
    client_id: string;
    saas_id: string;
    saas_plan_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    plan_code: string;
    status: string;
    current_period_end?: number | null;
  },
): DemoClientSaasSubscription {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const record = state.clientSaasSubscriptions.find((item) => item.stripe_subscription_id === payload.stripe_subscription_id);
  if (record) {
    record.client_id = payload.client_id;
    record.saas_id = payload.saas_id;
    record.saas_plan_id = payload.saas_plan_id;
    record.plan_code = payload.plan_code;
    record.status = payload.status;
    record.stripe_customer_id = payload.stripe_customer_id;
    record.current_period_end = typeof payload.current_period_end === 'undefined' ? record.current_period_end : payload.current_period_end;
    record.updated_at = now;
    return { ...record };
  }
  const created: DemoClientSaasSubscription = {
    id: generateId('css_sub'),
    tenant_id: tenantId,
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    saas_plan_id: payload.saas_plan_id,
    stripe_customer_id: payload.stripe_customer_id,
    stripe_subscription_id: payload.stripe_subscription_id,
    plan_code: payload.plan_code,
    status: payload.status,
    current_period_end: typeof payload.current_period_end === 'undefined' ? null : payload.current_period_end,
    created_at: now,
    updated_at: now,
  };
  state.clientSaasSubscriptions.push(created);
  return { ...created };
}

export function listDemoSubscriptions(tenantId: string): DemoSubscription[] {
  return ensureTenantState(tenantId).subscriptions.map((item) => ({ ...item }));
}

export function upsertDemoSubscription(
  tenantId: string,
  payload: {
    stripe_subscription_id: string;
    stripe_customer_id: string;
    client_id: string;
    saas_id: string;
    plan: string;
    status: string;
    current_period_end?: number | null;
  },
): DemoSubscription {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const record = state.subscriptions.find((item) => item.stripe_subscription_id === payload.stripe_subscription_id);
  if (record) {
    record.status = payload.status;
    record.plan = payload.plan;
    record.client_id = payload.client_id;
    record.saas_id = payload.saas_id;
    record.stripe_customer_id = payload.stripe_customer_id;
    record.current_period_end = typeof payload.current_period_end === "undefined" ? record.current_period_end : payload.current_period_end;
    record.updated_at = now;
    return { ...record };
  }
  const created: DemoSubscription = {
    id: generateId("sub"),
    tenant_id: tenantId,
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    stripe_customer_id: payload.stripe_customer_id,
    stripe_subscription_id: payload.stripe_subscription_id,
    plan: payload.plan,
    status: payload.status,
    current_period_end: typeof payload.current_period_end === "undefined" ? null : payload.current_period_end,
    created_at: now,
    updated_at: now,
  };
  state.subscriptions.push(created);
  return { ...created };
}

export function listDemoInvoices(tenantId: string): DemoInvoice[] {
  return ensureTenantState(tenantId).invoices.map((item) => ({ ...item }));
}

export function addDemoInvoice(
  tenantId: string,
  payload: {
    client_id: string;
    saas_id: string;
    amount_cents: number;
    currency: string;
    status: string;
    notes?: string | null;
    number?: string | null;
  },
): DemoInvoice {
  const state = ensureTenantState(tenantId);
  const record: DemoInvoice = {
    id: generateId("invoice"),
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    number: payload.number ?? null,
    amount_cents: payload.amount_cents,
    currency: payload.currency,
    status: payload.status,
    notes: typeof payload.notes === "undefined" ? null : payload.notes,
    created_at: new Date().toISOString(),
  };
  state.invoices.push(record);
  return { ...record };
}

export function updateDemoInvoice(
  tenantId: string,
  payload: { id: string; status?: string; notes?: string | null },
): DemoInvoice | null {
  const state = ensureTenantState(tenantId);
  const invoice = state.invoices.find((item) => item.id === payload.id);
  if (!invoice) return null;
  if (typeof payload.status !== "undefined") invoice.status = payload.status;
  if (typeof payload.notes !== "undefined") invoice.notes = payload.notes;
  return { ...invoice };
}

export function listDemoTickets(tenantId: string): DemoTicket[] {
  return ensureTenantState(tenantId).tickets.map((item) => ({ ...item }));
}

export function addDemoTicket(
  tenantId: string,
  payload: {
    client_id: string;
    saas_id: string | null;
    subject: string;
    description?: string | null;
    status: string;
    priority: string;
    channel?: string | null;
  },
): DemoTicket {
  const state = ensureTenantState(tenantId);
  const record: DemoTicket = {
    id: generateId("ticket"),
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    subject: payload.subject,
    description: payload.description ?? null,
    status: payload.status,
    priority: payload.priority,
    channel: typeof payload.channel === "undefined" ? "inbox" : payload.channel,
    created_at: new Date().toISOString(),
  };
  state.tickets.push(record);
  return { ...record };
}

export function updateDemoTicket(
  tenantId: string,
  payload: { id: string; status?: string; priority?: string; description?: string | null },
): DemoTicket | null {
  const state = ensureTenantState(tenantId);
  const ticket = state.tickets.find((item) => item.id === payload.id);
  if (!ticket) return null;
  if (typeof payload.status !== "undefined") ticket.status = payload.status;
  if (typeof payload.priority !== "undefined") ticket.priority = payload.priority;
  if (typeof payload.description !== "undefined") ticket.description = payload.description;
  return { ...ticket };
}

export function listDemoProvisions(tenantId: string): DemoProvision[] {
  return ensureTenantState(tenantId).provisions.map((item) => ({ ...item }));
}

export function addDemoProvision(
  tenantId: string,
  payload: { saas_id: string; step: string; status: string; details?: string | null },
): DemoProvision {
  const state = ensureTenantState(tenantId);
  const record: DemoProvision = {
    id: generateId("prov"),
    saas_id: payload.saas_id,
    step: payload.step,
    status: payload.status,
    details: typeof payload.details === "undefined" ? null : payload.details,
    created_at: new Date().toISOString(),
  };
  state.provisions.push(record);
  return { ...record };
}

export function updateDemoProvision(
  tenantId: string,
  payload: { id: string; status?: string; step?: string; details?: string | null },
): DemoProvision | null {
  const state = ensureTenantState(tenantId);
  const provision = state.provisions.find((item) => item.id === payload.id);
  if (!provision) return null;
  if (typeof payload.status !== "undefined") provision.status = payload.status;
  if (typeof payload.step !== "undefined") provision.step = payload.step;
  if (typeof payload.details !== "undefined") provision.details = payload.details;
  return { ...provision };
}


export function getDemoClinicProfile(tenantId: string, saasId: string): DemoClinicProfile | null {
  const profile = ensureTenantState(tenantId).clinicProfiles.find((item) => item.saas_id === saasId);
  return profile ? { ...profile } : null;
}

export function upsertDemoClinicProfile(
  tenantId: string,
  payload: Omit<DemoClinicProfile, "id" | "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoClinicProfile {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const existing = payload.id
    ? state.clinicProfiles.find((item) => item.id === payload.id)
    : state.clinicProfiles.find((item) => item.saas_id === payload.saas_id);
  if (existing) {
    existing.display_name = payload.display_name ?? existing.display_name;
    existing.city = payload.city ?? existing.city;
    existing.rooms_count = typeof payload.rooms_count === "number" ? payload.rooms_count : existing.rooms_count;
    existing.staff_count = typeof payload.staff_count === "number" ? payload.staff_count : existing.staff_count;
    existing.primary_goal = payload.primary_goal ?? existing.primary_goal;
    existing.channels = typeof payload.channels === "undefined" ? existing.channels : payload.channels;
    existing.client_id = payload.client_id ?? existing.client_id;
    existing.updated_at = now;
    return { ...existing };
  }
  const created: DemoClinicProfile = {
    id: payload.id?.trim() ?? generateId("clinic_profile"),
    tenant_id: tenantId,
    client_id: payload.client_id,
    saas_id: payload.saas_id,
    display_name: payload.display_name,
    city: payload.city ?? "",
    rooms_count: payload.rooms_count ?? 0,
    staff_count: payload.staff_count ?? 0,
    primary_goal: payload.primary_goal ?? "fill_agenda",
    channels: payload.channels ?? null,
    created_at: now,
    updated_at: now,
  };
  state.clinicProfiles.push(created);
  return { ...created };
}

export function listDemoClinicServices(tenantId: string, saasId: string): DemoClinicService[] {
  return ensureTenantState(tenantId).clinicServices.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoClinicService(
  tenantId: string,
  payload: Omit<DemoClinicService, "id" | "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoClinicService {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const existing = payload.id ? state.clinicServices.find((item) => item.id === payload.id) : null;
  if (existing) {
    existing.name = payload.name ?? existing.name;
    existing.duration_minutes = typeof payload.duration_minutes === "number" ? payload.duration_minutes : existing.duration_minutes;
    existing.base_price = typeof payload.base_price === "number" ? payload.base_price : existing.base_price;
    existing.is_active = typeof payload.is_active === "number" ? payload.is_active : existing.is_active;
    existing.updated_at = now;
    return { ...existing };
  }
  const created: DemoClinicService = {
    id: payload.id?.trim() ?? generateId("clinic_service"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    name: payload.name,
    duration_minutes: payload.duration_minutes ?? 60,
    base_price: payload.base_price ?? 0,
    is_active: typeof payload.is_active === "number" ? payload.is_active : 1,
    created_at: now,
    updated_at: now,
  };
  state.clinicServices.push(created);
  return { ...created };
}

export function listDemoClinicLeads(tenantId: string, saasId: string): DemoClinicLead[] {
  return ensureTenantState(tenantId).clinicLeads.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoClinicLead(
  tenantId: string,
  payload: Omit<DemoClinicLead, "id" | "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoClinicLead {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const existing = payload.id ? state.clinicLeads.find((item) => item.id === payload.id) : null;
  if (existing) {
    existing.name = payload.name ?? existing.name;
    existing.email = typeof payload.email === "undefined" ? existing.email : payload.email;
    existing.phone = typeof payload.phone === "undefined" ? existing.phone : payload.phone;
    existing.source = payload.source ?? existing.source;
    existing.interest = typeof payload.interest === "undefined" ? existing.interest : payload.interest;
    existing.status = payload.status ?? existing.status;
    existing.priority = payload.priority ?? existing.priority;
    existing.notes = typeof payload.notes === "undefined" ? existing.notes : payload.notes;
    existing.updated_at = now;
    return { ...existing };
  }
  const created: DemoClinicLead = {
    id: payload.id?.trim() ?? generateId("clinic_lead"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    name: payload.name,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    source: payload.source ?? "web",
    interest: payload.interest ?? null,
    status: payload.status ?? "new",
    priority: payload.priority ?? "medium",
    notes: payload.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  state.clinicLeads.push(created);
  return { ...created };
}

export function listDemoClinicAppointments(tenantId: string, saasId: string): DemoClinicAppointment[] {
  return ensureTenantState(tenantId).clinicAppointments.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoClinicAppointment(
  tenantId: string,
  payload: Omit<DemoClinicAppointment, "id" | "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoClinicAppointment {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const existing = payload.id ? state.clinicAppointments.find((item) => item.id === payload.id) : null;
  if (existing) {
    existing.lead_id = typeof payload.lead_id === "undefined" ? existing.lead_id : payload.lead_id;
    existing.patient_name = payload.patient_name ?? existing.patient_name;
    existing.service_id = typeof payload.service_id === "undefined" ? existing.service_id : payload.service_id;
    existing.starts_at = payload.starts_at ?? existing.starts_at;
    existing.ends_at = typeof payload.ends_at === "undefined" ? existing.ends_at : payload.ends_at;
    existing.status = payload.status ?? existing.status;
    existing.room_label = typeof payload.room_label === "undefined" ? existing.room_label : payload.room_label;
    existing.staff_name = typeof payload.staff_name === "undefined" ? existing.staff_name : payload.staff_name;
    existing.updated_at = now;
    return { ...existing };
  }
  const created: DemoClinicAppointment = {
    id: payload.id?.trim() ?? generateId("clinic_appt"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    lead_id: typeof payload.lead_id === "undefined" ? null : payload.lead_id,
    patient_name: payload.patient_name,
    service_id: typeof payload.service_id === "undefined" ? null : payload.service_id,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at ?? null,
    status: payload.status ?? "booked",
    room_label: payload.room_label ?? null,
    staff_name: payload.staff_name ?? null,
    created_at: now,
    updated_at: now,
  };
  state.clinicAppointments.push(created);
  return { ...created };
}

export function listDemoClinicReviews(tenantId: string, saasId: string): DemoClinicReview[] {
  return ensureTenantState(tenantId).clinicReviews.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function addDemoClinicReview(
  tenantId: string,
  payload: Omit<DemoClinicReview, "id" | "tenant_id" | "created_at">,
): DemoClinicReview {
  const now = new Date().toISOString();
  const record: DemoClinicReview = {
    id: generateId("clinic_review"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    patient_name: payload.patient_name,
    rating: payload.rating,
    text: payload.text,
    source: payload.source ?? "google",
    created_at: now,
  };
  ensureTenantState(tenantId).clinicReviews.push(record);
  return { ...record };
}

export function listDemoClinicFinanceEntries(tenantId: string, saasId: string): DemoClinicFinanceEntry[] {
  return ensureTenantState(tenantId).clinicFinance.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function addDemoClinicFinanceEntry(
  tenantId: string,
  payload: Omit<DemoClinicFinanceEntry, "id" | "tenant_id" | "created_at">,
): DemoClinicFinanceEntry {
  const record: DemoClinicFinanceEntry = {
    id: generateId("clinic_fin"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    appointment_id: typeof payload.appointment_id === "undefined" ? null : payload.appointment_id,
    service_name: payload.service_name,
    amount: payload.amount,
    currency: payload.currency ?? "EUR",
    paid_at: payload.paid_at,
    method: payload.method ?? "card",
    created_at: new Date().toISOString(),
  };
  ensureTenantState(tenantId).clinicFinance.push(record);
  return { ...record };
}

export function listDemoSaasServices(tenantId: string, saasId: string): DemoSaasService[] {
  return ensureTenantState(tenantId).saasServices.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasService(
  tenantId: string,
  payload: Omit<DemoSaasService, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasService {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_service");
  const index = state.saasServices.findIndex((item) => item.id === id);
  const record: DemoSaasService = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    name: payload.name,
    slug: payload.slug,
    category: payload.category ?? null,
    duration_minutes: payload.duration_minutes,
    current_price: payload.current_price,
    recommended_price: payload.recommended_price ?? null,
    is_active: typeof payload.is_active === "number" ? payload.is_active : 1,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasServices[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasServices[index] = record;
  } else {
    state.saasServices.push(record);
  }
  return { ...record };
}

export function listDemoSaasInventoryItems(tenantId: string, saasId: string): DemoSaasInventoryItem[] {
  return ensureTenantState(tenantId).saasInventoryItems.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function listDemoSaasInventoryMovements(tenantId: string, saasId: string, inventoryItemId?: string | null): DemoSaasInventoryMovement[] {
  return ensureTenantState(tenantId)
    .saasInventoryMovements.filter(
      (item) => item.saas_id === saasId && (!inventoryItemId || item.inventory_item_id === inventoryItemId),
    )
    .map((item) => ({ ...item }));
}

export function upsertDemoSaasInventoryItem(
  tenantId: string,
  payload: Omit<DemoSaasInventoryItem, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasInventoryItem {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_item");
  const index = state.saasInventoryItems.findIndex((item) => item.id === id);
  const record: DemoSaasInventoryItem = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    name: payload.name,
    sku: payload.sku ?? null,
    category: payload.category ?? null,
    unit: payload.unit ?? null,
    cost_per_unit: payload.cost_per_unit,
    stock_quantity: payload.stock_quantity ?? 0,
    min_stock_quantity: payload.min_stock_quantity ?? 0,
    preferred_supplier: payload.preferred_supplier ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasInventoryItems[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasInventoryItems[index] = record;
  } else {
    state.saasInventoryItems.push(record);
  }
  return { ...record };
}

export function addDemoSaasInventoryMovement(
  tenantId: string,
  payload: Omit<DemoSaasInventoryMovement, "tenant_id" | "created_at"> & { id?: string; created_at?: string },
): DemoSaasInventoryMovement {
  const record: DemoSaasInventoryMovement = {
    id: payload.id?.trim() ?? generateId("saas_move"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    inventory_item_id: payload.inventory_item_id,
    type: payload.type,
    quantity: payload.quantity,
    reason: payload.reason ?? null,
    source: payload.source ?? null,
    related_service_id: payload.related_service_id ?? null,
    related_employee_id: payload.related_employee_id ?? null,
    created_at: payload.created_at ?? new Date().toISOString(),
  };
  ensureTenantState(tenantId).saasInventoryMovements.push(record);
  return { ...record };
}

export function listDemoSaasExpenses(tenantId: string, saasId: string): DemoSaasExpense[] {
  return ensureTenantState(tenantId).saasExpenses.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasExpense(
  tenantId: string,
  payload: Omit<DemoSaasExpense, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasExpense {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_expense");
  const index = state.saasExpenses.findIndex((item) => item.id === id);
  const record: DemoSaasExpense = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    type: payload.type,
    label: payload.label,
    amount: payload.amount,
    currency: payload.currency ?? "EUR",
    period: payload.period,
    from_date: payload.from_date,
    to_date: typeof payload.to_date === "undefined" ? null : payload.to_date,
    source: payload.source ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasExpenses[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasExpenses[index] = record;
  } else {
    state.saasExpenses.push(record);
  }
  return { ...record };
}

export function getDemoSaasPricingSettings(tenantId: string, saasId: string): DemoSaasPricingSettings | null {
  const record = ensureTenantState(tenantId).saasPricingSettings.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function upsertDemoSaasPricingSettings(
  tenantId: string,
  payload: Omit<DemoSaasPricingSettings, "tenant_id" | "updated_at"> & { id?: string },
): DemoSaasPricingSettings {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_pricing");
  const index = state.saasPricingSettings.findIndex((item) => item.id === id || (item.saas_id === payload.saas_id && item.tenant_id === tenantId));
  const record: DemoSaasPricingSettings = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    target_margin_percent: payload.target_margin_percent,
    min_margin_percent: payload.min_margin_percent,
    occupancy_target_percent: payload.occupancy_target_percent,
    include_payroll: payload.include_payroll,
    include_rent: payload.include_rent,
    include_utilities: payload.include_utilities,
    include_products: payload.include_products,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasPricingSettings[index] = record;
  } else {
    state.saasPricingSettings.push(record);
  }
  return { ...record };
}

export function listDemoSaasServiceProducts(tenantId: string, saasId: string, serviceId?: string | null): DemoSaasServiceProduct[] {
  return ensureTenantState(tenantId)
    .saasServiceProducts.filter((item) => item.saas_id === saasId && (!serviceId || item.service_id === serviceId))
    .map((item) => ({ ...item }));
}

export function upsertDemoSaasServiceProduct(
  tenantId: string,
  payload: Omit<DemoSaasServiceProduct, "tenant_id"> & { id?: string },
): DemoSaasServiceProduct {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("saas_service_product");
  const index = state.saasServiceProducts.findIndex((item) => item.id === id);
  const record: DemoSaasServiceProduct = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    service_id: payload.service_id,
    inventory_item_id: payload.inventory_item_id,
    quantity_per_service: payload.quantity_per_service,
    metadata: payload.metadata ?? null,
  };
  if (index >= 0) {
    state.saasServiceProducts[index] = record;
  } else {
    state.saasServiceProducts.push(record);
  }
  return { ...record };
}

export function listDemoSaasSocialAccounts(tenantId: string, saasId: string): DemoSaasSocialAccount[] {
  return ensureTenantState(tenantId).saasSocialAccounts.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasSocialAccount(
  tenantId: string,
  payload: Omit<DemoSaasSocialAccount, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasSocialAccount {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("social_account");
  const index = state.saasSocialAccounts.findIndex((item) => item.id === id);
  const record: DemoSaasSocialAccount = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    provider: payload.provider,
    handle: payload.handle ?? null,
    display_name: payload.display_name ?? null,
    status: payload.status,
    auth_meta: payload.auth_meta ?? null,
    primary: typeof payload.primary === "number" ? payload.primary : 0,
    created_at: index >= 0 ? state.saasSocialAccounts[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasSocialAccounts[index] = record;
  } else {
    state.saasSocialAccounts.push(record);
  }
  if (isNodeDev) {
    saveSocialflowDemoSnapshot(tenantId);
  }
  return { ...record };
}

export function listDemoSaasSocialCampaigns(tenantId: string, saasId: string): DemoSaasSocialCampaign[] {
  return ensureTenantState(tenantId).saasSocialCampaigns.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasSocialCampaign(
  tenantId: string,
  payload: Omit<DemoSaasSocialCampaign, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasSocialCampaign {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("social_campaign");
  const index = state.saasSocialCampaigns.findIndex((item) => item.id === id);
  const record: DemoSaasSocialCampaign = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    name: payload.name,
    objective: payload.objective,
    status: payload.status,
    target_segment: payload.target_segment,
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
    budget_estimate: typeof payload.budget_estimate === "number" ? payload.budget_estimate : null,
    notes: payload.notes ?? null,
    created_at: index >= 0 ? state.saasSocialCampaigns[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasSocialCampaigns[index] = record;
  } else {
    state.saasSocialCampaigns.push(record);
  }
  if (isNodeDev) {
    saveSocialflowDemoSnapshot(tenantId);
  }
  return { ...record };
}

export function listDemoSaasSocialPosts(
  tenantId: string,
  saasId: string,
  filters?: { campaignId?: string | null; status?: string | null; provider?: string | null },
): DemoSaasSocialPost[] {
  return ensureTenantState(tenantId)
    .saasSocialPosts.filter((item) => {
      if (item.saas_id !== saasId) return false;
      if (filters?.campaignId && item.campaign_id !== filters.campaignId) return false;
      if (filters?.status && item.status !== filters.status) return false;
      if (filters?.provider && item.provider !== filters.provider) return false;
      return true;
    })
    .map((item) => ({ ...item }));
}

export function getDemoSaasSocialPostById(tenantId: string, postId: string): DemoSaasSocialPost | null {
  const record = ensureTenantState(tenantId).saasSocialPosts.find((item) => item.id === postId);
  return record ? { ...record } : null;
}

export function upsertDemoSaasSocialPost(
  tenantId: string,
  payload: Omit<DemoSaasSocialPost, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasSocialPost {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("social_post");
  const index = state.saasSocialPosts.findIndex((item) => item.id === id);
  const record: DemoSaasSocialPost = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    campaign_id: payload.campaign_id ?? null,
    provider: payload.provider,
    content_type: payload.content_type,
    title: payload.title,
    body: payload.body,
    image_hint: payload.image_hint ?? null,
    status: payload.status,
    scheduled_at: payload.scheduled_at ?? null,
    posted_at: payload.posted_at ?? null,
    external_post_id: payload.external_post_id ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasSocialPosts[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasSocialPosts[index] = record;
  } else {
    state.saasSocialPosts.push(record);
  }
  if (isNodeDev) {
    saveSocialflowDemoSnapshot(tenantId);
  }
  return { ...record };
}

export function updateDemoSaasSocialPostStatus(
  tenantId: string,
  payload: { id: string; status: DemoSaasSocialPost["status"]; posted_at?: string | null },
): DemoSaasSocialPost | null {
  const state = ensureTenantState(tenantId);
  const record = state.saasSocialPosts.find((item) => item.id === payload.id);
  if (!record) return null;
  record.status = payload.status;
  if (payload.status === "POSTED" || payload.status === "PUBLISHED") {
    record.posted_at = payload.posted_at ?? record.posted_at ?? new Date().toISOString();
  }
  record.updated_at = new Date().toISOString();
  if (isNodeDev) {
    saveSocialflowDemoSnapshot(tenantId);
  }
  return { ...record };
}

export function listDemoSaasSocialMetricsForPost(tenantId: string, postId: string): DemoSaasSocialMetrics[] {
  return ensureTenantState(tenantId).saasSocialMetrics.filter((item) => item.post_id === postId).map((item) => ({ ...item }));
}

export function upsertDemoSaasSocialMetric(
  tenantId: string,
  payload: Omit<DemoSaasSocialMetrics, "tenant_id"> & { id?: string },
): DemoSaasSocialMetrics {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("social_metric");
  const index = state.saasSocialMetrics.findIndex((item) => item.id === id);
  const record: DemoSaasSocialMetrics = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    post_id: payload.post_id,
    provider: payload.provider,
    impressions: payload.impressions,
    likes: payload.likes,
    comments: payload.comments,
    shares: payload.shares,
    clicks: payload.clicks,
    leads_generated: payload.leads_generated,
    captured_at: payload.captured_at,
    metadata: payload.metadata ?? null,
  };
  if (index >= 0) {
    state.saasSocialMetrics[index] = record;
  } else {
    state.saasSocialMetrics.push(record);
  }
  if (isNodeDev) {
    saveSocialflowDemoSnapshot(tenantId);
  }
  return { ...record };
}

export function listDemoSaasDomains(tenantId: string, saasId: string): DemoSaasDomain[] {
  return ensureTenantState(tenantId).saasDomains.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasDomain(
  tenantId: string,
  payload: Omit<DemoSaasDomain, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasDomain {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_domain");
  const index = state.saasDomains.findIndex((item) => item.id === id);
  const record: DemoSaasDomain = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    domain: payload.domain,
    is_primary: typeof payload.is_primary === "number" ? payload.is_primary : 0,
    status: payload.status,
    last_checked_at: payload.last_checked_at ?? null,
    created_at: index >= 0 ? state.saasDomains[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasDomains[index] = record;
  } else {
    state.saasDomains.push(record);
  }
  return { ...record };
}

export function setDemoSaasPrimaryDomain(tenantId: string, saasId: string, domainId: string): void {
  const state = ensureTenantState(tenantId);
  state.saasDomains = state.saasDomains.map((item) => {
    if (item.saas_id !== saasId) return item;
    return { ...item, is_primary: item.id === domainId ? 1 : 0, updated_at: new Date().toISOString() };
  });
}

export function getDemoSaasBlueprint(tenantId: string, saasId: string): DemoSaasBlueprint | null {
  const record = ensureTenantState(tenantId).saasBlueprints.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function saveDemoSaasBlueprint(
  tenantId: string,
  payload: Omit<DemoSaasBlueprint, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasBlueprint {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_blueprint");
  const index = state.saasBlueprints.findIndex((item) => item.id === id || item.saas_id === payload.saas_id);
  const record: DemoSaasBlueprint = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    business_type: payload.business_type,
    primary_goal: payload.primary_goal,
    maturity_stage: payload.maturity_stage,
    notes: payload.notes ?? null,
    created_at: index >= 0 ? state.saasBlueprints[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasBlueprints[index] = record;
  } else {
    state.saasBlueprints.push(record);
  }
  return { ...record };
}

export function listDemoSaasModules(tenantId: string, saasId: string): DemoSaasModule[] {
  return ensureTenantState(tenantId).saasModules.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function listDemoSaasFeatures(tenantId: string, saasId: string): DemoSaasFeature[] {
  return ensureTenantState(tenantId).saasFeatures.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function upsertDemoSaasFeature(
  tenantId: string,
  payload: Omit<DemoSaasFeature, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasFeature {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_feature");
  const index = state.saasFeatures.findIndex(
    (item) => item.id === id || (item.saas_id === payload.saas_id && item.feature_key === payload.feature_key),
  );
  const record: DemoSaasFeature = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    feature_key: payload.feature_key,
    label: payload.label,
    category: payload.category,
    status: payload.status,
    source: payload.source,
    phase_order: typeof payload.phase_order === "number" ? payload.phase_order : 0,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasFeatures[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasFeatures[index] = record;
  } else {
    state.saasFeatures.push(record);
  }
  return { ...record };
}

export function getDemoBrandingForSaas(tenantId: string, saasId: string): DemoSaasBrandingSettings | null {
  const record = ensureTenantState(tenantId).saasBrandingSettings.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function upsertDemoBrandingSettings(
  tenantId: string,
  payload: Omit<DemoSaasBrandingSettings, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasBrandingSettings {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_branding");
  const index = state.saasBrandingSettings.findIndex(
    (item) => item.id === id || (item.saas_id === payload.saas_id && item.tenant_id === tenantId),
  );
  const record: DemoSaasBrandingSettings = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    primary_color: payload.primary_color,
    secondary_color: payload.secondary_color,
    accent_color: payload.accent_color,
    background_color: payload.background_color,
    surface_color: payload.surface_color,
    text_color: payload.text_color,
    danger_color: payload.danger_color,
    success_color: payload.success_color,
    logo_url: payload.logo_url ?? null,
    favicon_url: payload.favicon_url ?? null,
    hero_image_url: payload.hero_image_url ?? null,
    layout_density: payload.layout_density,
    enable_dark_mode: payload.enable_dark_mode ?? 1,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasBrandingSettings[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasBrandingSettings[index] = record;
  } else {
    state.saasBrandingSettings.push(record);
  }
  return { ...record };
}

export function getDemoUserPreferences(
  tenantId: string,
  saasId: string,
  userId: string,
): DemoSaasUserUiPreference | null {
  const record = ensureTenantState(tenantId).saasUserUiPreferences.find(
    (item) => item.saas_id === saasId && item.user_id === userId,
  );
  return record ? { ...record } : null;
}

export function upsertDemoUserPreferences(
  tenantId: string,
  payload: Omit<DemoSaasUserUiPreference, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasUserUiPreference {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("ui_pref");
  const index = state.saasUserUiPreferences.findIndex(
    (item) => item.id === id || (item.saas_id === payload.saas_id && item.user_id === payload.user_id),
  );
  const record: DemoSaasUserUiPreference = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    user_id: payload.user_id,
    role_type: payload.role_type,
    layout_density_override: payload.layout_density_override ?? null,
    default_section: payload.default_section ?? null,
    hidden_widgets: payload.hidden_widgets ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasUserUiPreferences[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasUserUiPreferences[index] = record;
  } else {
    state.saasUserUiPreferences.push(record);
  }
  return { ...record };
}

export function saveDemoSaasModules(
  tenantId: string,
  saasId: string,
  modules: Array<Omit<DemoSaasModule, "tenant_id" | "created_at" | "updated_at"> & { id?: string }>,
): DemoSaasModule[] {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  modules.forEach((payload) => {
    const id = payload.id?.trim() ?? generateId("saas_module");
    const index = state.saasModules.findIndex((item) => item.id === id);
    const record: DemoSaasModule = {
      id,
      tenant_id: tenantId,
      saas_id: saasId,
      code: payload.code,
      label: payload.label,
      phase: payload.phase,
      status: payload.status,
      importance: payload.importance,
      description: payload.description ?? null,
      created_at: index >= 0 ? state.saasModules[index].created_at : now,
      updated_at: now,
    };
    if (index >= 0) {
      state.saasModules[index] = record;
    } else {
      state.saasModules.push(record);
    }
  });
  return listDemoSaasModules(tenantId, saasId);
}

export function listDemoSaasInterviewAnswers(tenantId: string, saasId: string): DemoSaasInterviewAnswer[] {
  return ensureTenantState(tenantId).saasInterviewAnswers.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function recordDemoSaasInterviewAnswers(
  tenantId: string,
  saasId: string,
  answers: Array<Omit<DemoSaasInterviewAnswer, "tenant_id" | "saas_id" | "created_at" | "id"> & { id?: string }>,
): DemoSaasInterviewAnswer[] {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  answers.forEach((answer) => {
    const record: DemoSaasInterviewAnswer = {
      id: answer.id?.trim() ?? generateId("saas_interview"),
      tenant_id: tenantId,
      saas_id: saasId,
      question_code: answer.question_code,
      answer_text: answer.answer_text,
      metadata: answer.metadata ?? null,
      created_at: now,
    };
    state.saasInterviewAnswers.push(record);
  });
  return listDemoSaasInterviewAnswers(tenantId, saasId);
}

export function listDemoSaasTasks(tenantId: string, saasId: string): DemoSaasTask[] {
  return ensureTenantState(tenantId).saasTasks.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function getDemoSaasTaskById(tenantId: string, taskId: string): DemoSaasTask | null {
  const record = ensureTenantState(tenantId).saasTasks.find((item) => item.id === taskId);
  return record ? { ...record } : null;
}

export function createDemoSaasTask(
  tenantId: string,
  payload: Omit<DemoSaasTask, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasTask {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("task");
  const record: DemoSaasTask = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    title: payload.title,
    description: payload.description ?? null,
    category: payload.category,
    source: payload.source,
    status: payload.status,
    severity: payload.severity,
    assignee_employee_id: payload.assignee_employee_id ?? null,
    due_date: payload.due_date ?? null,
    metadata: payload.metadata ?? null,
    created_at: now,
    updated_at: now,
  };
  state.saasTasks.push(record);
  return { ...record };
}

export function updateDemoSaasTask(
  tenantId: string,
  taskId: string,
  updates: Partial<Omit<DemoSaasTask, "tenant_id" | "saas_id" | "created_at">>,
): DemoSaasTask | null {
  const state = ensureTenantState(tenantId);
  const index = state.saasTasks.findIndex((item) => item.id === taskId);
  if (index < 0) return null;
  const current = state.saasTasks[index];
  const updated: DemoSaasTask = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  state.saasTasks[index] = updated;
  return { ...updated };
}

export function listDemoSaasTaskEvents(tenantId: string, saasId: string, taskId?: string | null): DemoSaasTaskEvent[] {
  return ensureTenantState(tenantId)
    .saasTaskEvents.filter((item) => item.saas_id === saasId && (!taskId || item.task_id === taskId))
    .map((item) => ({ ...item }));
}

export function appendDemoSaasTaskEvent(
  tenantId: string,
  payload: Omit<DemoSaasTaskEvent, "tenant_id" | "created_at" | "id"> & { id?: string },
): DemoSaasTaskEvent {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const record: DemoSaasTaskEvent = {
    id: payload.id?.trim() ?? generateId("task_event"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    task_id: payload.task_id,
    type: payload.type,
    payload: payload.payload ?? null,
    created_at: now,
  };
  state.saasTaskEvents.push(record);
  return { ...record };
}

export function listDemoKnowledgeSpaces(tenantId: string, saasId: string): DemoKnowledgeSpace[] {
  return ensureTenantState(tenantId).knowledgeSpaces.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function createDemoKnowledgeSpace(
  tenantId: string,
  payload: Omit<DemoKnowledgeSpace, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoKnowledgeSpace {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const record: DemoKnowledgeSpace = {
    id: payload.id?.trim() ?? generateId("knowledge_space"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    slug: payload.slug,
    label: payload.label,
    description: payload.description ?? null,
    is_active: typeof payload.is_active === "number" ? payload.is_active : 1,
    created_at: now,
    updated_at: now,
  };
  state.knowledgeSpaces.push(record);
  return { ...record };
}

export function listDemoKnowledgeDocuments(
  tenantId: string,
  saasId: string,
  filters?: { spaceId?: string | null; status?: string | null; tag?: string | null; searchQuery?: string | null },
): DemoKnowledgeDocument[] {
  return ensureTenantState(tenantId).knowledgeDocuments
    .filter((item) => item.saas_id === saasId)
    .filter((item) => {
      if (filters?.spaceId && item.space_id !== filters.spaceId) return false;
      if (filters?.status && item.status !== filters.status) return false;
      if (filters?.tag) {
        const tags = item.tags ? (JSON.parse(item.tags) as string[]) : [];
        if (!tags.includes(filters.tag)) return false;
      }
      if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .map((item) => ({ ...item }));
}

export function listDemoKnowledgeDocumentsForTarget(
  tenantId: string,
  saasId: string,
  targetType: string,
  targetId: string,
): DemoKnowledgeDocument[] {
  const links = ensureTenantState(tenantId).knowledgeLinks.filter(
    (link) => link.saas_id === saasId && link.target_type === targetType && link.target_id === targetId,
  );
  const ids = new Set(links.map((link) => link.document_id));
  return ensureTenantState(tenantId).knowledgeDocuments
    .filter((doc) => doc.saas_id === saasId && ids.has(doc.id))
    .map((item) => ({ ...item }));
}

export function getDemoKnowledgeDocumentById(tenantId: string, documentId: string): DemoKnowledgeDocument | null {
  const record = ensureTenantState(tenantId).knowledgeDocuments.find((item) => item.id === documentId);
  return record ? { ...record } : null;
}

export function createDemoKnowledgeDocument(
  tenantId: string,
  payload: Omit<DemoKnowledgeDocument, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoKnowledgeDocument {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("knowledge_doc");
  const record: DemoKnowledgeDocument = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    space_id: payload.space_id ?? null,
    title: payload.title,
    type: payload.type,
    source: payload.source,
    status: payload.status,
    audience: payload.audience ?? "BOTH",
    importance: payload.importance ?? "STANDARD",
    summary: payload.summary ?? null,
    content: payload.content,
    tags: payload.tags ?? null,
    created_by_employee_id: payload.created_by_employee_id ?? null,
    created_at: now,
    updated_at: now,
    metadata: payload.metadata ?? null,
  };
  state.knowledgeDocuments.push(record);
  return { ...record };
}

export function updateDemoKnowledgeDocument(
  tenantId: string,
  documentId: string,
  updates: Partial<Omit<DemoKnowledgeDocument, "tenant_id" | "saas_id" | "created_at">>,
): DemoKnowledgeDocument | null {
  const state = ensureTenantState(tenantId);
  const index = state.knowledgeDocuments.findIndex((item) => item.id === documentId);
  if (index < 0) return null;
  const current = state.knowledgeDocuments[index];
  const updated: DemoKnowledgeDocument = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  state.knowledgeDocuments[index] = updated;
  return { ...updated };
}

export function createDemoKnowledgeLink(
  tenantId: string,
  payload: Omit<DemoKnowledgeLink, "tenant_id" | "created_at"> & { id?: string },
): DemoKnowledgeLink {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const record: DemoKnowledgeLink = {
    id: payload.id?.trim() ?? generateId("knowledge_link"),
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    document_id: payload.document_id,
    target_type: payload.target_type,
    target_id: payload.target_id,
    created_at: now,
  };
  state.knowledgeLinks.push(record);
  return { ...record };
}

export function listDemoKnowledgeLinksForTarget(
  tenantId: string,
  saasId: string,
  targetType: string,
  targetId: string,
): DemoKnowledgeLink[] {
  return ensureTenantState(tenantId)
    .knowledgeLinks.filter((item) => item.saas_id === saasId && item.target_type === targetType && item.target_id === targetId)
    .map((item) => ({ ...item }));
}

export function listDemoKnowledgeLinksForDocument(tenantId: string, saasId: string, documentId: string): DemoKnowledgeLink[] {
  return ensureTenantState(tenantId)
    .knowledgeLinks.filter((item) => item.saas_id === saasId && item.document_id === documentId)
    .map((item) => ({ ...item }));
}

export function deleteDemoKnowledgeLink(tenantId: string, linkId: string): boolean {
  const state = ensureTenantState(tenantId);
  const index = state.knowledgeLinks.findIndex((item) => item.id === linkId);
  if (index < 0) return false;
  state.knowledgeLinks.splice(index, 1);
  return true;
}

export function listDemoSaasCustomers(tenantId: string, saasId: string): DemoSaasCustomer[] {
  return ensureTenantState(tenantId).saasCustomers.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function getDemoSaasCustomer(tenantId: string, customerId: string, saasId?: string | null): DemoSaasCustomer | null {
  const record = ensureTenantState(tenantId).saasCustomers.find((item) => item.id === customerId && (!saasId || item.saas_id === saasId));
  return record ? { ...record } : null;
}

export function upsertDemoSaasCustomer(
  tenantId: string,
  payload: Omit<DemoSaasCustomer, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasCustomer {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("customer");
  const index = state.saasCustomers.findIndex((item) => item.id === id);
  const record: DemoSaasCustomer = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    full_name: payload.full_name,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    notes: payload.notes ?? null,
    preferred_employee_id: payload.preferred_employee_id ?? null,
    preferred_services: payload.preferred_services ?? null,
    style_profile: payload.style_profile ?? null,
    is_vip: payload.is_vip ?? 0,
    vip_level: payload.vip_level ?? (payload.is_vip ? "VIP" : "REGULAR"),
    created_at: index >= 0 ? state.saasCustomers[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasCustomers[index] = record;
  } else {
    state.saasCustomers.push(record);
  }
  return { ...record };
}

export function getDemoSaasCustomerProfile(tenantId: string, customerId: string, saasId?: string | null): DemoSaasCustomerProfile | null {
  const record = ensureTenantState(tenantId).saasCustomerProfiles.find((item) => item.customer_id === customerId && (!saasId || item.saas_id === saasId));
  return record ? { ...record } : null;
}

export function upsertDemoSaasCustomerProfile(
  tenantId: string,
  payload: Omit<DemoSaasCustomerProfile, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasCustomerProfile {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("customer_profile");
  const index = state.saasCustomerProfiles.findIndex((item) => item.id === id);
  const record: DemoSaasCustomerProfile = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    customer_id: payload.customer_id,
    tags: payload.tags ?? null,
    preferences: payload.preferences ?? null,
    birthday: typeof payload.birthday === "undefined" ? null : payload.birthday,
    style_profile_json: payload.style_profile_json ?? null,
    last_style_review_at: typeof payload.last_style_review_at === "undefined" ? null : payload.last_style_review_at,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasCustomerProfiles[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasCustomerProfiles[index] = record;
  } else {
    state.saasCustomerProfiles.push(record);
  }
  return { ...record };
}

export function listDemoSaasCustomerStyleNotes(
  tenantId: string,
  customerId: string,
  saasId?: string | null,
): DemoSaasCustomerStyleNote[] {
  return ensureTenantState(tenantId).saasCustomerStyleNotes
    .filter((item) => item.customer_id === customerId && (!saasId || item.saas_id === saasId))
    .map((item) => ({ ...item }));
}

export function addDemoSaasCustomerStyleNote(
  tenantId: string,
  payload: Omit<DemoSaasCustomerStyleNote, "tenant_id"> & { id?: string },
): DemoSaasCustomerStyleNote {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("customer_style_note");
  const record: DemoSaasCustomerStyleNote = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    customer_id: payload.customer_id,
    note_type: payload.note_type,
    content: payload.content,
    source: payload.source,
    created_at: payload.created_at ?? new Date().toISOString(),
  };
  state.saasCustomerStyleNotes.push(record);
  return { ...record };
}

export function listDemoEmailMessages(tenantId: string, saasId: string): DemoSaasEmailMessage[] {
  return ensureTenantState(tenantId).saasEmailMessages.filter((item) => item.saas_id === saasId).map((item) => ({ ...item }));
}

export function listDemoSaasConversations(
  tenantId: string,
  saasId: string,
  filters?: { status?: ConversationStatus | null; channel?: ConversationChannel | null; search?: string | null },
): DemoSaasConversation[] {
  const search = filters?.search?.trim().toLowerCase() ?? null;
  return ensureTenantState(tenantId)
    .saasConversations.filter((item) => {
      if (item.saas_id !== saasId) return false;
      if (filters?.status && item.status !== filters.status) return false;
      if (filters?.channel && item.channel !== filters.channel) return false;
      if (search) {
        const haystack = `${item.subject ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((item) => ({ ...item }));
}

export function getDemoSaasConversation(tenantId: string, conversationId: string): DemoSaasConversation | null {
  const record = ensureTenantState(tenantId).saasConversations.find((item) => item.id === conversationId);
  return record ? { ...record } : null;
}

export function upsertDemoSaasConversation(
  tenantId: string,
  payload: Omit<DemoSaasConversation, "tenant_id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
): DemoSaasConversation {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("conversation");
  const index = state.saasConversations.findIndex((item) => item.id === id);
  const record: DemoSaasConversation = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    customer_id: typeof payload.customer_id === "undefined" ? null : payload.customer_id,
    channel: payload.channel,
    subject: typeof payload.subject === "undefined" ? null : payload.subject,
    status: payload.status,
    last_message_at: typeof payload.last_message_at === "undefined" ? null : payload.last_message_at,
    last_customer_message_at: typeof payload.last_customer_message_at === "undefined" ? null : payload.last_customer_message_at,
    last_staff_message_at: typeof payload.last_staff_message_at === "undefined" ? null : payload.last_staff_message_at,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasConversations[index].created_at : payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
  if (index >= 0) {
    state.saasConversations[index] = record;
  } else {
    state.saasConversations.push(record);
  }
  return { ...record };
}

export function listDemoConversationMessages(tenantId: string, conversationId: string): DemoSaasConversationMessage[] {
  return ensureTenantState(tenantId)
    .saasConversationMessages.filter((item) => item.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((item) => ({ ...item }));
}

export function createDemoConversationMessage(
  tenantId: string,
  payload: Omit<DemoSaasConversationMessage, "tenant_id" | "created_at"> & { id?: string; created_at?: string },
): DemoSaasConversationMessage {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("conv_msg");
  const createdAt = payload.created_at ?? new Date().toISOString();
  const record: DemoSaasConversationMessage = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    conversation_id: payload.conversation_id,
    customer_id: typeof payload.customer_id === "undefined" ? null : payload.customer_id,
    employee_id: typeof payload.employee_id === "undefined" ? null : payload.employee_id,
    sender_type: payload.sender_type,
    direction: payload.direction,
    body: payload.body,
    provider_message_id: payload.provider_message_id ?? null,
    created_at: createdAt,
  };
  state.saasConversationMessages.push(record);
  const conversationIndex = state.saasConversations.findIndex((item) => item.id === payload.conversation_id);
  if (conversationIndex >= 0) {
    const conversation = state.saasConversations[conversationIndex];
    const lastMessageAt = createdAt;
    const isCustomer = payload.sender_type === "CUSTOMER";
    const isStaff = payload.sender_type === "STAFF";
    state.saasConversations[conversationIndex] = {
      ...conversation,
      last_message_at: lastMessageAt,
      last_customer_message_at: isCustomer ? lastMessageAt : conversation.last_customer_message_at,
      last_staff_message_at: isStaff ? lastMessageAt : conversation.last_staff_message_at,
      updated_at: lastMessageAt,
      status: payload.direction === "INBOUND" && isCustomer && conversation.status === "RESOLVED" ? "OPEN" : conversation.status,
    };
  }
  return { ...record };
}

export function listDemoNotifications(
  tenantId: string,
  filters?: { saasId?: string | null; employeeId?: string | null; unreadOnly?: boolean },
): DemoSaasNotification[] {
  return ensureTenantState(tenantId)
    .saasNotifications.filter((item) => {
      if (typeof filters?.saasId !== "undefined" && item.saas_id !== filters.saasId) return false;
      if (typeof filters?.employeeId !== "undefined" && item.employee_id !== filters.employeeId) return false;
      if (filters?.unreadOnly && item.is_read === 1) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((item) => ({ ...item }));
}

export function createDemoNotification(
  tenantId: string,
  payload: Omit<DemoSaasNotification, "tenant_id" | "created_at" | "is_read"> & { id?: string; created_at?: string; is_read?: number },
): DemoSaasNotification {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("notification");
  const createdAt = payload.created_at ?? new Date().toISOString();
  const record: DemoSaasNotification = {
    id,
    tenant_id: tenantId,
    saas_id: typeof payload.saas_id === "undefined" ? null : payload.saas_id,
    employee_id: typeof payload.employee_id === "undefined" ? null : payload.employee_id,
    type: payload.type,
    severity: payload.severity,
    title: payload.title,
    body: payload.body,
    related_entity_type: typeof payload.related_entity_type === "undefined" ? null : payload.related_entity_type,
    related_entity_id: typeof payload.related_entity_id === "undefined" ? null : payload.related_entity_id,
    is_read: typeof payload.is_read === "number" ? payload.is_read : 0,
    created_at: createdAt,
  };
  state.saasNotifications.push(record);
  return { ...record };
}

export function listDemoWhatsappIdentities(tenantId: string, saasId: string): DemoWhatsappIdentity[] {
  return ensureTenantState(tenantId)
    .saasWhatsappIdentities.filter((item) => item.saas_id === saasId)
    .map((item) => ({ ...item }));
}

export function getDemoWhatsappIdentityByPhone(
  tenantId: string,
  saasId: string,
  phoneNumber: string,
): DemoWhatsappIdentity | null {
  const record = ensureTenantState(tenantId).saasWhatsappIdentities.find(
    (item) => item.saas_id === saasId && item.phone_number === phoneNumber,
  );
  return record ? { ...record } : null;
}

export function upsertDemoWhatsappIdentity(
  tenantId: string,
  payload: Omit<DemoWhatsappIdentity, "tenant_id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
): DemoWhatsappIdentity {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("wa_identity");
  const index = state.saasWhatsappIdentities.findIndex(
    (item) => item.saas_id === payload.saas_id && item.phone_number === payload.phone_number,
  );
  const record: DemoWhatsappIdentity = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    actor_type: payload.actor_type,
    actor_id: payload.actor_id,
    phone_number: payload.phone_number,
    preferred_language: payload.preferred_language ?? null,
    allowed_channels: payload.allowed_channels ?? null,
    consent_flags: payload.consent_flags ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasWhatsappIdentities[index].created_at : payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
  if (index >= 0) {
    state.saasWhatsappIdentities[index] = record;
  } else {
    state.saasWhatsappIdentities.push(record);
  }
  return { ...record };
}

export function addDemoWhatsappMessage(
  tenantId: string,
  payload: Omit<DemoWhatsappMessage, "tenant_id" | "created_at"> & { id?: string; created_at?: string },
): DemoWhatsappMessage {
  const state = ensureTenantState(tenantId);
  const now = payload.created_at ?? new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("wa_msg");
  const index = state.saasWhatsappMessages.findIndex((item) => item.id === id);
  const record: DemoWhatsappMessage = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    phone_number: payload.phone_number,
    direction: payload.direction,
    actor_type: typeof payload.actor_type === "undefined" ? null : payload.actor_type,
    actor_id: typeof payload.actor_id === "undefined" ? null : payload.actor_id,
    conversation_id: typeof payload.conversation_id === "undefined" ? null : payload.conversation_id,
    body: payload.body,
    intent: typeof payload.intent === "undefined" ? null : payload.intent,
    status: payload.status,
    provider_message_id: typeof payload.provider_message_id === "undefined" ? null : payload.provider_message_id,
    metadata: typeof payload.metadata === "undefined" ? null : payload.metadata,
    created_at: now,
  };
  if (index >= 0) {
    state.saasWhatsappMessages[index] = { ...state.saasWhatsappMessages[index], ...record };
  } else {
    state.saasWhatsappMessages.push(record);
  }
  return { ...record };
}

export function getDemoWhatsappMessageById(tenantId: string, messageId: string): DemoWhatsappMessage | null {
  const record = ensureTenantState(tenantId).saasWhatsappMessages.find((item) => item.id === messageId);
  return record ? { ...record } : null;
}

export function updateDemoWhatsappMessage(
  tenantId: string,
  messageId: string,
  updates: Partial<Omit<DemoWhatsappMessage, "tenant_id" | "saas_id" | "phone_number" | "created_at">>,
): DemoWhatsappMessage | null {
  const state = ensureTenantState(tenantId);
  const index = state.saasWhatsappMessages.findIndex((item) => item.id === messageId);
  if (index < 0) return null;
  const current = state.saasWhatsappMessages[index];
  const updated: DemoWhatsappMessage = {
    ...current,
    ...updates,
  };
  state.saasWhatsappMessages[index] = updated;
  return { ...updated };
}

export function listDemoWhatsappMessagesForPhone(
  tenantId: string,
  saasId: string,
  phoneNumber: string,
  limit = 20,
): DemoWhatsappMessage[] {
  return ensureTenantState(tenantId)
    .saasWhatsappMessages.filter((item) => item.saas_id === saasId && item.phone_number === phoneNumber)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((item) => ({ ...item }));
}

export function getDemoTaxProfileForSaas(tenantId: string, saasId: string): DemoSaasTaxProfile | null {
  const record = ensureTenantState(tenantId).saasTaxProfiles.find((item) => item.saas_id === saasId);
  return record ? { ...record } : null;
}

export function upsertDemoTaxProfile(
  tenantId: string,
  payload: Omit<DemoSaasTaxProfile, "tenant_id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
): DemoSaasTaxProfile {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("tax_profile");
  const index = state.saasTaxProfiles.findIndex((item) => item.saas_id === payload.saas_id);
  const record: DemoSaasTaxProfile = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    country: payload.country,
    region: payload.region ?? null,
    regime: payload.regime,
    default_vat_rate: payload.default_vat_rate,
    reduced_vat_rate: payload.reduced_vat_rate ?? null,
    super_reduced_vat_rate: payload.super_reduced_vat_rate ?? null,
    uses_withholding: payload.uses_withholding,
    withholding_rate: payload.withholding_rate,
    income_tax_mode: payload.income_tax_mode,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasTaxProfiles[index].created_at : payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
  if (index >= 0) {
    state.saasTaxProfiles[index] = record;
  } else {
    state.saasTaxProfiles.push(record);
  }
  return { ...record };
}

export function listDemoTaxPeriodsForSaas(tenantId: string, saasId: string): DemoSaasTaxPeriod[] {
  return ensureTenantState(tenantId)
    .saasTaxPeriods.filter((item) => item.saas_id === saasId)
    .map((item) => ({ ...item }));
}

export function getDemoTaxPeriodByKey(
  tenantId: string,
  saasId: string,
  periodType: string,
  periodKey: string,
): DemoSaasTaxPeriod | null {
  const record = ensureTenantState(tenantId).saasTaxPeriods.find(
    (item) => item.saas_id === saasId && item.period_type === periodType && item.period_key === periodKey,
  );
  return record ? { ...record } : null;
}

export function upsertDemoTaxPeriod(
  tenantId: string,
  payload: Omit<DemoSaasTaxPeriod, "tenant_id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string },
): DemoSaasTaxPeriod {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("tax_period");
  const index = state.saasTaxPeriods.findIndex(
    (item) => item.saas_id === payload.saas_id && item.period_type === payload.period_type && item.period_key === payload.period_key,
  );
  const record: DemoSaasTaxPeriod = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    period_type: payload.period_type,
    period_key: payload.period_key,
    start_date: payload.start_date,
    end_date: payload.end_date,
    status: payload.status,
    estimated_revenue: payload.estimated_revenue,
    estimated_expenses: payload.estimated_expenses,
    vat_collected: payload.vat_collected,
    vat_paid: payload.vat_paid,
    vat_due: payload.vat_due,
    income_tax_base: payload.income_tax_base,
    income_tax_due: payload.income_tax_due,
    notes: payload.notes ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasTaxPeriods[index].created_at : payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
  if (index >= 0) {
    state.saasTaxPeriods[index] = record;
  } else {
    state.saasTaxPeriods.push(record);
  }
  return { ...record };
}

export function markDemoNotificationRead(tenantId: string, notificationId: string, isRead: boolean): DemoSaasNotification | null {
  const state = ensureTenantState(tenantId);
  const index = state.saasNotifications.findIndex((item) => item.id === notificationId);
  if (index < 0) return null;
  const record = state.saasNotifications[index];
  const updated: DemoSaasNotification = {
    ...record,
    is_read: isRead ? 1 : 0,
  };
  state.saasNotifications[index] = updated;
  return { ...updated };
}

export function createDemoEmailMessage(
  tenantId: string,
  payload: Omit<DemoSaasEmailMessage, "tenant_id" | "created_at" | "updated_at"> & { id?: string },
): DemoSaasEmailMessage {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("email");
  const record: DemoSaasEmailMessage = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    from_address: payload.from_address,
    from_name: payload.from_name ?? null,
    to_address: payload.to_address ?? null,
    subject: payload.subject ?? null,
    snippet: payload.snippet ?? null,
    body: payload.body ?? null,
    received_at: payload.received_at,
    classification: payload.classification,
    sub_type: payload.sub_type ?? null,
    status: payload.status ?? "NEW",
    parsed_amount: payload.parsed_amount ?? null,
    parsed_currency: payload.parsed_currency ?? null,
    parsed_due_date: payload.parsed_due_date ?? null,
    parsed_supplier_name: payload.parsed_supplier_name ?? null,
    linked_expense_id: payload.linked_expense_id ?? null,
    linked_customer_id: payload.linked_customer_id ?? null,
    metadata: payload.metadata ?? null,
    created_at: now,
    updated_at: now,
  };
  state.saasEmailMessages.push(record);
  return { ...record };
}

export function listDemoSaasCustomerBookings(tenantId: string, saasId: string, customerId?: string | null): DemoSaasCustomerBooking[] {
  return ensureTenantState(tenantId)
    .saasCustomerBookings.filter((item) => item.saas_id === saasId && (!customerId || item.customer_id === customerId))
    .map((item) => ({ ...item }));
}

export function listDemoSaasAppointments(
  tenantId: string,
  saasId: string,
  filter?: { from?: string | null; to?: string | null; employeeId?: string | null; customerId?: string | null },
): DemoSaasAppointment[] {
  return ensureTenantState(tenantId)
    .saasAppointments.filter((item) => {
      if (item.saas_id !== saasId) return false;
      if (filter?.employeeId && item.employee_id !== filter.employeeId) return false;
      if (filter?.customerId && item.customer_id !== filter.customerId) return false;
      const start = new Date(item.scheduled_start).getTime();
      if (filter?.from && start < new Date(filter.from).getTime()) return false;
      if (filter?.to && start > new Date(filter.to).getTime()) return false;
      return true;
    })
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
    .map((item) => ({ ...item }));
}

export function listDemoAppointmentsForEmployee(
  tenantId: string,
  saasId: string,
  employeeId: string,
  filter?: { from?: string | null; to?: string | null },
): DemoSaasAppointment[] {
  return listDemoSaasAppointments(tenantId, saasId, { ...filter, employeeId });
}

export function getDemoSaasAppointment(tenantId: string, appointmentId: string, saasId?: string | null): DemoSaasAppointment | null {
  const record = ensureTenantState(tenantId).saasAppointments.find(
    (item) => item.id === appointmentId && (!saasId || item.saas_id === saasId),
  );
  return record ? { ...record } : null;
}

export function upsertDemoSaasAppointment(
  tenantId: string,
  payload: Omit<DemoSaasAppointment, "tenant_id"> & { id?: string },
): DemoSaasAppointment {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("appointment");
  const index = state.saasAppointments.findIndex((item) => item.id === id);
  const record: DemoSaasAppointment = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    service_id: payload.service_id,
    employee_id: payload.employee_id,
    customer_id: payload.customer_id ?? null,
    client_name: payload.client_name,
    client_contact: payload.client_contact ?? null,
    scheduled_start: payload.scheduled_start,
    scheduled_end: payload.scheduled_end,
    status: payload.status,
    price_at_booking: typeof payload.price_at_booking === "number" ? payload.price_at_booking : null,
    social_campaign_id: payload.social_campaign_id ?? null,
    social_post_id: payload.social_post_id ?? null,
    source_channel: payload.source_channel ?? null,
    notes: payload.notes ?? null,
    created_at: index >= 0 ? state.saasAppointments[index].created_at : payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
  if (index >= 0) {
    state.saasAppointments[index] = record;
  } else {
    state.saasAppointments.push(record);
  }
  return { ...record };
}

export function addDemoSaasCustomerBooking(
  tenantId: string,
  payload: Omit<DemoSaasCustomerBooking, "tenant_id"> & { id?: string },
): DemoSaasCustomerBooking {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("customer_booking");
  const record: DemoSaasCustomerBooking = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    customer_id: payload.customer_id,
    service_id: payload.service_id,
    employee_id: payload.employee_id ?? null,
    start_time: payload.start_time,
    end_time: payload.end_time,
    status: payload.status,
    price_at_booking: typeof payload.price_at_booking === "number" ? payload.price_at_booking : null,
    notes: payload.notes ?? null,
    created_at: payload.created_at ?? new Date().toISOString(),
    updated_at: payload.updated_at ?? new Date().toISOString(),
  };
  const existingIndex = state.saasCustomerBookings.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    state.saasCustomerBookings[existingIndex] = record;
  } else {
    state.saasCustomerBookings.push(record);
  }
  return { ...record };
}

export function getDemoSaasCustomerMetrics(tenantId: string, customerId: string, saasId?: string | null): DemoSaasCustomerMetrics | null {
  const record = ensureTenantState(tenantId).saasCustomerMetrics.find((item) => item.customer_id === customerId && (!saasId || item.saas_id === saasId));
  return record ? { ...record } : null;
}

export function upsertDemoSaasCustomerMetrics(
  tenantId: string,
  payload: Omit<DemoSaasCustomerMetrics, "tenant_id"> & { id?: string },
): DemoSaasCustomerMetrics {
  const state = ensureTenantState(tenantId);
  const id = payload.id?.trim() ?? generateId("customer_metrics");
  const index = state.saasCustomerMetrics.findIndex((item) => item.id === id);
  const record: DemoSaasCustomerMetrics = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    customer_id: payload.customer_id,
    total_visits: payload.total_visits,
    total_revenue: payload.total_revenue,
    last_visit_at: typeof payload.last_visit_at === "undefined" ? null : payload.last_visit_at,
    avg_ticket: typeof payload.avg_ticket === "undefined" ? null : payload.avg_ticket,
    no_show_count: payload.no_show_count ?? 0,
    created_at: payload.created_at ?? new Date().toISOString(),
    updated_at: payload.updated_at ?? new Date().toISOString(),
  };
  if (index >= 0) {
    state.saasCustomerMetrics[index] = record;
  } else {
    state.saasCustomerMetrics.push(record);
  }
  return { ...record };
}

export interface DemoVendorExpense {
  id: string;
  tenant_id: string;
  label: string;
  type: DrakoVendorExpenseType;
  amount: number;
  currency: string;
  period: DrakoVendorExpensePeriod;
  from_date: string;
  to_date: string | null;
  vertical_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DemoBaselineNeed {
  id: string;
  tenant_id: string;
  label: string;
  category: DrakoBaselineNeedCategory;
  amount_monthly: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DemoTreasuryAccount {
  id: string;
  tenant_id: string;
  label: string;
  type: DrakoTreasuryAccountType;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DemoTreasuryMovement {
  id: string;
  tenant_id: string;
  account_id: string;
  kind: "INFLOW" | "OUTFLOW";
  label: string;
  amount: number;
  currency: string;
  source: "SaaS_RENTAL" | "TAX_PAYMENT" | "IA_TOOLS" | "INFRA" | "TRANSFER" | "OTHER";
  saas_id: string | null;
  period: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DemoSaasMarketingPlan {
  id: string;
  tenant_id: string;
  saas_id: string;
  included_posts_per_month: number;
  included_campaigns_per_month: number;
  extra_post_price: number;
  extra_campaign_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoSaasMarketingUsage {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  posts_published: number;
  campaigns_launched: number;
  source: SaasMarketingUsageSource;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DemoSaasPaidAdsSpend {
  id: string;
  tenant_id: string;
  saas_id: string;
  period_month: number;
  period_year: number;
  channel: SaasPaidAdsChannel;
  amount: number;
  currency: string;
  billed_to_client: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const DEMO_VENDOR_EXPENSES: Omit<DemoVendorExpense, "tenant_id">[] = [
  {
    id: "ve_1",
    label: "Cloudflare + R2",
    type: "INFRA",
    amount: 420,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: null,
    metadata: { vendor: "Cloudflare", scope: "edge + storage" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_2",
    label: "Postgres backups",
    type: "INFRA",
    amount: 180,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: "CLINIC",
    metadata: { vendor: "Neon", region: "eu-central" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_3",
    label: "OpenAI API usage",
    type: "AI",
    amount: 650,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: null,
    metadata: { vendor: "OpenAI", scope: "assistants + chat" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_4",
    label: "Embeddings pipeline",
    type: "AI",
    amount: 210,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: "SALON",
    metadata: { vendor: "Fireworks", scope: "embeddings" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_5",
    label: "Meta ads - Salon",
    type: "MARKETING",
    amount: 900,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: "SALON",
    metadata: { channel: "meta", campaign: "salon_growth" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_6",
    label: "Google ads - Clinic",
    type: "MARKETING",
    amount: 720,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: "CLINIC",
    metadata: { channel: "google", campaign: "clinic_leads" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_7",
    label: "Support tooling",
    type: "SUPPORT",
    amount: 130,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: null,
    metadata: { vendor: "Zendesk", seats: 4 },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_8",
    label: "Core team costs",
    type: "TEAM",
    amount: 8200,
    currency: "EUR",
    period: "MONTHLY",
    from_date: "2024-04-01",
    to_date: null,
    vertical_id: null,
    metadata: { headcount: 6 },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "ve_9",
    label: "Laundry launch promo",
    type: "MARKETING",
    amount: 400,
    currency: "EUR",
    period: "ONE_OFF",
    from_date: "2024-03-15",
    to_date: "2024-03-31",
    vertical_id: "LAUNDRY",
    metadata: { channel: "local_press" },
    created_at: "2024-03-15T00:00:00Z",
    updated_at: "2024-03-15T00:00:00Z",
  },
  {
    id: "ve_10",
    label: "Brand refresh",
    type: "OTHER",
    amount: 1800,
    currency: "EUR",
    period: "ONE_OFF",
    from_date: "2024-02-10",
    to_date: "2024-02-28",
    vertical_id: null,
    metadata: { scope: "landing + deck" },
    created_at: "2024-02-10T00:00:00Z",
    updated_at: "2024-02-10T00:00:00Z",
  },
];

const DEMO_BASELINE_NEEDS: Omit<DemoBaselineNeed, "tenant_id">[] = [
  {
    id: "bl_1",
    label: "Alquiler casa",
    category: "LIFE",
    amount_monthly: 600,
    currency: "EUR",
    metadata: { fixed: true },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "bl_2",
    label: "Luz",
    category: "LIFE",
    amount_monthly: 80,
    currency: "EUR",
    metadata: { fixed: true },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "bl_3",
    label: "Agua",
    category: "LIFE",
    amount_monthly: 30,
    currency: "EUR",
    metadata: { fixed: true },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "bl_4",
    label: "Comida",
    category: "LIFE",
    amount_monthly: 250,
    currency: "EUR",
    metadata: { fixed: true },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "bl_5",
    label: "Internet casa",
    category: "WORK",
    amount_monthly: 50,
    currency: "EUR",
    metadata: { fixed: true },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
];

const DEMO_SAAS_MARKETING_PLANS: Omit<DemoSaasMarketingPlan, "tenant_id">[] = [
  {
    id: "smp_salon_1",
    saas_id: "saas_demo_operativo",
    included_posts_per_month: 8,
    included_campaigns_per_month: 0,
    extra_post_price: 25,
    extra_campaign_price: 120,
    notes: "Plan base salon",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "smp_clinic_1",
    saas_id: "saas_demo_scale",
    included_posts_per_month: 12,
    included_campaigns_per_month: 1,
    extra_post_price: 35,
    extra_campaign_price: 160,
    notes: "Plan standard scale",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "smp_launch_1",
    saas_id: "saas_demo_lanzamiento",
    included_posts_per_month: 20,
    included_campaigns_per_month: 2,
    extra_post_price: 40,
    extra_campaign_price: 180,
    notes: "Plan full lanzamiento",
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
];

const DEMO_SAAS_MARKETING_USAGE: Omit<DemoSaasMarketingUsage, "tenant_id">[] = [
  {
    id: "smu_salon_apr",
    saas_id: "saas_demo_operativo",
    period_month: 4,
    period_year: 2024,
    posts_published: 7,
    campaigns_launched: 0,
    source: "AUTOPILOT",
    metadata: { notes: "Contenido orgánico semanal" },
    created_at: "2024-04-28T10:00:00Z",
    updated_at: "2024-04-28T10:00:00Z",
  },
  {
    id: "smu_clinic_apr",
    saas_id: "saas_demo_scale",
    period_month: 4,
    period_year: 2024,
    posts_published: 3,
    campaigns_launched: 0,
    source: "STAFF",
    metadata: { notes: "Uso ligero del pack standard" },
    created_at: "2024-04-27T12:00:00Z",
    updated_at: "2024-04-27T12:00:00Z",
  },
  {
    id: "smu_launch_apr",
    saas_id: "saas_demo_lanzamiento",
    period_month: 4,
    period_year: 2024,
    posts_published: 10,
    campaigns_launched: 1,
    source: "STAFF",
    metadata: { notes: "Uso estable de full pack" },
    created_at: "2024-04-26T09:00:00Z",
    updated_at: "2024-04-26T09:00:00Z",
  },
];

const DEMO_SAAS_PAID_ADS_SPEND: Omit<DemoSaasPaidAdsSpend, "tenant_id">[] = [
  {
    id: "ads_salon_meta",
    saas_id: "saas_demo_operativo",
    period_month: 4,
    period_year: 2024,
    channel: "META_ADS",
    amount: 500,
    currency: "EUR",
    billed_to_client: 1,
    metadata: { campaign: "salon_promo" },
    created_at: "2024-04-29T09:00:00Z",
    updated_at: "2024-04-29T09:00:00Z",
  },
  {
    id: "ads_clinic_google",
    saas_id: "saas_demo_scale",
    period_month: 4,
    period_year: 2024,
    channel: "GOOGLE_ADS",
    amount: 800,
    currency: "EUR",
    billed_to_client: 1,
    metadata: { campaign: "clinic_leads" },
    created_at: "2024-04-29T09:00:00Z",
    updated_at: "2024-04-29T09:00:00Z",
  },
  {
    id: "ads_launch_meta",
    saas_id: "saas_demo_lanzamiento",
    period_month: 4,
    period_year: 2024,
    channel: "META_ADS",
    amount: 600,
    currency: "EUR",
    billed_to_client: 1,
    metadata: { campaign: "launch_awareness" },
    created_at: "2024-04-29T09:00:00Z",
    updated_at: "2024-04-29T09:00:00Z",
  },
];

const DEMO_TREASURY_ACCOUNTS: Omit<DemoTreasuryAccount, "tenant_id">[] = [
  {
    id: "tre_acc_tax",
    label: "Reserva impuestos",
    type: "TAX_RESERVE",
    currency: "EUR",
    metadata: { targetQuarter: "2024-Q2" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "tre_acc_infra",
    label: "Reserva infra",
    type: "INFRA_RESERVE",
    currency: "EUR",
    metadata: { scope: "Cloud + Edge" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "tre_acc_ai",
    label: "Reserva IA",
    type: "AI_RESERVE",
    currency: "EUR",
    metadata: { scope: "LLM + embeddings" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "tre_acc_personal",
    label: "Gastos personales",
    type: "PERSONAL_SPENDING",
    currency: "EUR",
    metadata: { owner: "Cris" },
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "tre_acc_general",
    label: "Caja general",
    type: "GENERAL",
    currency: "EUR",
    metadata: null,
    created_at: "2024-04-01T00:00:00Z",
    updated_at: "2024-04-01T00:00:00Z",
  },
];

const DEMO_TREASURY_MOVEMENTS: Omit<DemoTreasuryMovement, "tenant_id">[] = [
  {
    id: "tre_mov_inflow_1",
    account_id: "tre_acc_general",
    kind: "INFLOW",
    label: "Ingresos SaaS Abril",
    amount: 6200,
    currency: "EUR",
    source: "SaaS_RENTAL",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-30T18:00:00Z",
    metadata: { note: "MRR consolidado" },
    created_at: "2024-04-30T18:00:00Z",
    updated_at: "2024-04-30T18:00:00Z",
  },
  {
    id: "tre_mov_tax_reserve",
    account_id: "tre_acc_tax",
    kind: "INFLOW",
    label: "Reserva impuestos Abril",
    amount: 800,
    currency: "EUR",
    source: "TRANSFER",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-30T19:00:00Z",
    metadata: { from: "tre_acc_general" },
    created_at: "2024-04-30T19:00:00Z",
    updated_at: "2024-04-30T19:00:00Z",
  },
  {
    id: "tre_mov_infra_reserve",
    account_id: "tre_acc_infra",
    kind: "INFLOW",
    label: "Reserva infra Abril",
    amount: 260,
    currency: "EUR",
    source: "TRANSFER",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-30T19:05:00Z",
    metadata: { from: "tre_acc_general" },
    created_at: "2024-04-30T19:05:00Z",
    updated_at: "2024-04-30T19:05:00Z",
  },
  {
    id: "tre_mov_ai_reserve",
    account_id: "tre_acc_ai",
    kind: "INFLOW",
    label: "Reserva IA Abril",
    amount: 350,
    currency: "EUR",
    source: "TRANSFER",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-30T19:10:00Z",
    metadata: { from: "tre_acc_general" },
    created_at: "2024-04-30T19:10:00Z",
    updated_at: "2024-04-30T19:10:00Z",
  },
  {
    id: "tre_mov_personal",
    account_id: "tre_acc_personal",
    kind: "INFLOW",
    label: "Sueldo disponible",
    amount: 900,
    currency: "EUR",
    source: "TRANSFER",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-30T19:15:00Z",
    metadata: { from: "tre_acc_general" },
    created_at: "2024-04-30T19:15:00Z",
    updated_at: "2024-04-30T19:15:00Z",
  },
  {
    id: "tre_mov_infra_out",
    account_id: "tre_acc_infra",
    kind: "OUTFLOW",
    label: "Pago Cloud Abril",
    amount: 210,
    currency: "EUR",
    source: "INFRA",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-28T10:00:00Z",
    metadata: { vendor: "Cloudflare" },
    created_at: "2024-04-28T10:00:00Z",
    updated_at: "2024-04-28T10:00:00Z",
  },
  {
    id: "tre_mov_ai_out",
    account_id: "tre_acc_ai",
    kind: "OUTFLOW",
    label: "Pago modelos IA Abril",
    amount: 520,
    currency: "EUR",
    source: "IA_TOOLS",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-27T12:00:00Z",
    metadata: { vendor: "OpenAI" },
    created_at: "2024-04-27T12:00:00Z",
    updated_at: "2024-04-27T12:00:00Z",
  },
  {
    id: "tre_mov_tax_payment",
    account_id: "tre_acc_tax",
    kind: "OUTFLOW",
    label: "Pago modelo 303",
    amount: 300,
    currency: "EUR",
    source: "TAX_PAYMENT",
    saas_id: null,
    period: "2024-04",
    occurred_at: "2024-04-20T09:00:00Z",
    metadata: { quarter: "2024-Q1" },
    created_at: "2024-04-20T09:00:00Z",
    updated_at: "2024-04-20T09:00:00Z",
  },
];

export function listDemoVendorExpenses(
  tenantId: string,
  filters?: {
    from?: string;
    to?: string;
    type?: DrakoVendorExpenseType;
    period?: DrakoVendorExpensePeriod;
    verticalId?: string | null;
  },
): DemoVendorExpense[] {
  const state = ensureTenantState(tenantId);
  
  // If no vendor expenses exist yet, initialize with DEMO_VENDOR_EXPENSES for the tenant
  if (state.vendorExpenses.length === 0) {
    state.vendorExpenses = DEMO_VENDOR_EXPENSES.map((expense) => ({
      ...expense,
      tenant_id: tenantId,
    }));
  }
  
  return state.vendorExpenses
    .filter((expense) => {
      if (filters?.from && expense.from_date < filters.from) return false;
      if (filters?.to && expense.to_date && expense.to_date > filters.to) return false;
      if (filters?.type && expense.type !== filters.type) return false;
      if (filters?.period && expense.period !== filters.period) return false;
      if (filters?.verticalId !== undefined) {
        if (filters.verticalId === null && expense.vertical_id !== null) return false;
        if (filters.verticalId !== null && expense.vertical_id !== filters.verticalId) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.from_date !== b.from_date) return a.from_date > b.from_date ? -1 : 1;
      if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .map((expense) => ({ ...expense }));
}

export function upsertDemoVendorExpense(
  tenantId: string,
  payload: Omit<DemoVendorExpense, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoVendorExpense {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("vendor_expense");
  const index = state.vendorExpenses.findIndex((item) => item.id === id);
  
  const record: DemoVendorExpense = {
    id,
    tenant_id: tenantId,
    label: payload.label,
    type: payload.type,
    amount: payload.amount,
    currency: payload.currency,
    period: payload.period,
    from_date: payload.from_date,
    to_date: payload.to_date ?? null,
    vertical_id: payload.vertical_id ?? null,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.vendorExpenses[index].created_at : now,
    updated_at: now,
  };

  if (index >= 0) {
    state.vendorExpenses[index] = record;
  } else {
    state.vendorExpenses.push(record);
  }
  
  return { ...record };
}

export function deleteDemoVendorExpense(tenantId: string, id: string): boolean {
  const state = ensureTenantState(tenantId);
  const index = state.vendorExpenses.findIndex((item) => item.id === id);
  
  if (index >= 0) {
    state.vendorExpenses.splice(index, 1);
    return true;
  }
  
  return false;
}

export function getDemoVendorMonthlyAggregates(
  tenantId: string,
  params: { from: string; to: string },
): {
  byType: Array<{ month: string; type: DrakoVendorExpenseType; total: number }>;
  byVertical: Array<{ month: string; verticalId: string | null; total: number }>;
} {
  const expenses = listDemoVendorExpenses(tenantId, {
    from: `${params.from}-01`,
    to: `${params.to}-31`,
  });

  const byType = new Map<string, Map<DrakoVendorExpenseType, number>>();
  const byVertical = new Map<string, Map<string | null, number>>();

  for (const expense of expenses) {
    const month = expense.from_date.slice(0, 7);
    let monthlyAmount = expense.amount;
    if (expense.period === "YEARLY") {
      monthlyAmount = expense.amount / 12;
    } else if (expense.period === "ONE_OFF") {
      monthlyAmount = expense.amount;
    }

    if (!byType.has(month)) {
      byType.set(month, new Map());
    }
    const typeMap = byType.get(month)!;
    typeMap.set(expense.type, (typeMap.get(expense.type) || 0) + monthlyAmount);

    if (!byVertical.has(month)) {
      byVertical.set(month, new Map());
    }
    const verticalMap = byVertical.get(month)!;
    const verticalId = expense.vertical_id ?? null;
    verticalMap.set(verticalId, (verticalMap.get(verticalId) || 0) + monthlyAmount);
  }

  const byTypeArray: Array<{ month: string; type: DrakoVendorExpenseType; total: number }> = [];
  for (const [month, typeMap] of byType) {
    for (const [type, total] of typeMap) {
      byTypeArray.push({ month, type, total });
    }
  }

  const byVerticalArray: Array<{ month: string; verticalId: string | null; total: number }> = [];
  for (const [month, verticalMap] of byVertical) {
    for (const [verticalId, total] of verticalMap) {
      byVerticalArray.push({ month, verticalId, total });
    }
  }

  return {
    byType: byTypeArray,
    byVertical: byVerticalArray,
  };
}

export function listDemoBaselineNeeds(tenantId: string): DemoBaselineNeed[] {
  const state = ensureTenantState(tenantId);
  if (state.baselineNeeds.length === 0) {
    state.baselineNeeds = DEMO_BASELINE_NEEDS.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.baselineNeeds
    .slice()
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.label.localeCompare(b.label);
    })
    .map((item) => ({ ...item }));
}

export function upsertDemoBaselineNeed(
  tenantId: string,
  payload: Omit<DemoBaselineNeed, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoBaselineNeed {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("baseline_need");
  const index = state.baselineNeeds.findIndex((item) => item.id === id);
  const record: DemoBaselineNeed = {
    id,
    tenant_id: tenantId,
    label: payload.label,
    category: payload.category,
    amount_monthly: payload.amount_monthly,
    currency: payload.currency,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.baselineNeeds[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.baselineNeeds[index] = record;
  } else {
    state.baselineNeeds.push(record);
  }
  return { ...record };
}

export function deleteDemoBaselineNeed(tenantId: string, id: string): boolean {
  const state = ensureTenantState(tenantId);
  const index = state.baselineNeeds.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.baselineNeeds.splice(index, 1);
    return true;
  }
  return false;
}

export function listDemoSaasMarketingPlans(tenantId: string): DemoSaasMarketingPlan[] {
  const state = ensureTenantState(tenantId);
  if (state.saasMarketingPlans.length === 0) {
    state.saasMarketingPlans = DEMO_SAAS_MARKETING_PLANS.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.saasMarketingPlans.map((item) => ({ ...item }));
}

export function getDemoSaasMarketingPlans(tenantId: string): DemoSaasMarketingPlan[] {
  return listDemoSaasMarketingPlans(tenantId);
}

export function upsertDemoSaasMarketingPlan(
  tenantId: string,
  payload: Omit<DemoSaasMarketingPlan, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoSaasMarketingPlan {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_marketing_plan");
  const index = state.saasMarketingPlans.findIndex((item) => item.id === id);
  const record: DemoSaasMarketingPlan = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    included_posts_per_month: payload.included_posts_per_month,
    included_campaigns_per_month: payload.included_campaigns_per_month,
    extra_post_price: payload.extra_post_price,
    extra_campaign_price: payload.extra_campaign_price,
    notes: payload.notes ?? null,
    created_at: index >= 0 ? state.saasMarketingPlans[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasMarketingPlans[index] = record;
  } else {
    state.saasMarketingPlans.push(record);
  }
  return { ...record };
}

export function listDemoSaasMarketingUsage(
  tenantId: string,
  params?: { saasId?: string; month?: number; year?: number },
): DemoSaasMarketingUsage[] {
  const state = ensureTenantState(tenantId);
  if (state.saasMarketingUsage.length === 0) {
    state.saasMarketingUsage = DEMO_SAAS_MARKETING_USAGE.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.saasMarketingUsage
    .filter((item) => {
      if (params?.saasId && item.saas_id !== params.saasId) return false;
      if (params?.month && item.period_month !== params.month) return false;
      if (params?.year && item.period_year !== params.year) return false;
      return true;
    })
    .map((item) => ({ ...item }));
}

export function getDemoSaasMarketingUsage(
  tenantId: string,
  params?: { saasId?: string; month?: number; year?: number },
): DemoSaasMarketingUsage[] {
  return listDemoSaasMarketingUsage(tenantId, params);
}

export function recordDemoSaasMarketingUsage(
  tenantId: string,
  payload: Omit<DemoSaasMarketingUsage, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoSaasMarketingUsage {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_marketing_usage");
  const index = state.saasMarketingUsage.findIndex((item) => item.id === id);
  const record: DemoSaasMarketingUsage = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    period_month: payload.period_month,
    period_year: payload.period_year,
    posts_published: payload.posts_published,
    campaigns_launched: payload.campaigns_launched,
    source: payload.source,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasMarketingUsage[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasMarketingUsage[index] = record;
  } else {
    state.saasMarketingUsage.push(record);
  }
  return { ...record };
}

export function listDemoSaasPaidAdsSpend(
  tenantId: string,
  params?: { saasId?: string; month?: number; year?: number },
): DemoSaasPaidAdsSpend[] {
  const state = ensureTenantState(tenantId);
  if (state.saasPaidAdsSpend.length === 0) {
    state.saasPaidAdsSpend = DEMO_SAAS_PAID_ADS_SPEND.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.saasPaidAdsSpend
    .filter((item) => {
      if (params?.saasId && item.saas_id !== params.saasId) return false;
      if (params?.month && item.period_month !== params.month) return false;
      if (params?.year && item.period_year !== params.year) return false;
      return true;
    })
    .map((item) => ({ ...item }));
}

export function getDemoSaasPaidAdsSpend(
  tenantId: string,
  params?: { saasId?: string; month?: number; year?: number },
): DemoSaasPaidAdsSpend[] {
  return listDemoSaasPaidAdsSpend(tenantId, params);
}

export function recordDemoSaasPaidAdsSpend(
  tenantId: string,
  payload: Omit<DemoSaasPaidAdsSpend, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoSaasPaidAdsSpend {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("saas_paid_ads");
  const index = state.saasPaidAdsSpend.findIndex((item) => item.id === id);
  const record: DemoSaasPaidAdsSpend = {
    id,
    tenant_id: tenantId,
    saas_id: payload.saas_id,
    period_month: payload.period_month,
    period_year: payload.period_year,
    channel: payload.channel,
    amount: payload.amount,
    currency: payload.currency,
    billed_to_client: payload.billed_to_client,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.saasPaidAdsSpend[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.saasPaidAdsSpend[index] = record;
  } else {
    state.saasPaidAdsSpend.push(record);
  }
  return { ...record };
}

export function listDemoTreasuryAccounts(tenantId: string): DemoTreasuryAccount[] {
  const state = ensureTenantState(tenantId);
  if (state.treasuryAccounts.length === 0) {
    state.treasuryAccounts = DEMO_TREASURY_ACCOUNTS.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.treasuryAccounts.map((item) => ({ ...item }));
}

export function listDemoTreasuryMovements(
  tenantId: string,
  params?: { period?: string },
): DemoTreasuryMovement[] {
  const state = ensureTenantState(tenantId);
  if (state.treasuryMovements.length === 0) {
    state.treasuryMovements = DEMO_TREASURY_MOVEMENTS.map((item) => ({
      ...item,
      tenant_id: tenantId,
    }));
  }
  return state.treasuryMovements
    .filter((movement) => {
      if (params?.period && movement.period !== params.period) return false;
      return true;
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((item) => ({ ...item }));
}

export function registerDemoTreasuryMovement(
  tenantId: string,
  payload: Omit<DemoTreasuryMovement, "tenant_id" | "created_at" | "updated_at" | "id"> & { id?: string },
): DemoTreasuryMovement {
  const state = ensureTenantState(tenantId);
  const now = new Date().toISOString();
  const id = payload.id?.trim() ?? generateId("treasury_movement");
  const index = state.treasuryMovements.findIndex((item) => item.id === id);
  const record: DemoTreasuryMovement = {
    id,
    tenant_id: tenantId,
    account_id: payload.account_id,
    kind: payload.kind,
    label: payload.label,
    amount: payload.amount,
    currency: payload.currency,
    source: payload.source,
    saas_id: payload.saas_id ?? null,
    period: payload.period ?? null,
    occurred_at: payload.occurred_at,
    metadata: payload.metadata ?? null,
    created_at: index >= 0 ? state.treasuryMovements[index].created_at : now,
    updated_at: now,
  };
  if (index >= 0) {
    state.treasuryMovements[index] = record;
  } else {
    state.treasuryMovements.push(record);
  }
  return { ...record };
}
