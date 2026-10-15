// Shapes mirror docs/FRONTEND_INTEGRATION_GUIDE.md section 12 (and /docs Swagger).
// Amounts are decimal STRINGS ("1500.00"); never do arithmetic on them in the UI.

export type Money = string;
export type ISODate = string;
export type ISODateTime = string;

export type Role = "admin" | "volunteer" | "donor";
export type VolunteerStatus = "pending" | "approved" | "deactivated";
export type CampaignStatus = "draft" | "active" | "closed";
export type CampaignCloseReason = "goal_reached" | "end_date_passed" | "manual";
export type DonationStatus = "pending" | "completed" | "failed";
export type PaymentMethod = "card" | "upi" | "net_banking";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type AttendanceStatus = "registered" | "attended" | "no_show";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  volunteer_id: number | null;
  volunteer_status: VolunteerStatus | null;
  donor_id: number | null;
}
export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: UserOut;
}

export interface CampaignOut {
  campaign_id: number;
  title: string;
  description: string;
  category: string;
  goal_amount: Money;
  amount_raised: Money;
  amount_remaining: Money;
  progress_percent: number;
  start_date: ISODate;
  end_date: ISODate;
  status: CampaignStatus;
  closed_reason: CampaignCloseReason | null;
  created_at: ISODateTime;
  published_at: ISODateTime | null;
  closed_at: ISODateTime | null;
}

export interface DonationOut {
  donation_id: number;
  campaign_id: number;
  campaign_title: string;
  donor_id: number;
  donor_name: string;
  amount: Money;
  payment_method: PaymentMethod;
  status: DonationStatus;
  receipt_number: string | null;
  donation_date: ISODateTime;
  completed_at: ISODateTime | null;
  failure_reason: string | null;
  retry_of_id: number | null;
}
export interface DonationInitiated {
  donation: DonationOut;
  access_token: string;
  confirmation: { campaign_title: string; amount: Money; payment_method: PaymentMethod; donor_name: string };
}
export interface ReceiptOut {
  receipt_number: string;
  ngo_name: string;
  donor_name: string;
  donor_email: string;
  pan_tax_id: string | null;
  amount: Money;
  currency: string;
  campaign_title: string;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  donation_date: ISODateTime;
}
export interface DonationCreateBody {
  campaign_id: number;
  amount: string;
  payment_method: PaymentMethod;
  donor?: { name: string; email: string; phone_number?: string };
  pan_tax_id?: string;
}

export interface RegistrationBrief {
  registration_id: number;
  task: string | null;
  attendance_status: AttendanceStatus;
}
export interface EventOut {
  event_id: number;
  title: string;
  description: string;
  event_date: ISODateTime;
  location: string;
  volunteers_required: number;
  status: EventStatus;
  registered_count: number;
  slots_remaining: number;
  is_full: boolean;
  my_registration: RegistrationBrief | null;
}
export interface EventBrief {
  event_id: number;
  title: string;
  event_date: ISODateTime;
  location: string;
  status: EventStatus;
}
export interface RegistrationOut {
  registration_id: number;
  event: EventBrief;
  task: string | null;
  attendance_status: AttendanceStatus;
  registered_at: ISODateTime;
}
export interface RosterEntry {
  registration_id: number;
  task: string | null;
  attendance_status: AttendanceStatus;
  registered_at: ISODateTime;
  volunteer: { volunteer_id: number; name: string; email: string; phone_number: string };
}

export interface VolunteerOut {
  volunteer_id: number;
  name: string;
  email: string;
  phone_number: string;
  areas_of_interest: string[];
  availability: string | null;
  status: VolunteerStatus;
  created_at: ISODateTime;
}
export interface VolunteerAdminDetail extends VolunteerOut {
  assignment_history: RegistrationOut[];
}
export interface VolunteerDashboard {
  volunteer: VolunteerOut;
  upcoming_assignments: RegistrationOut[];
  events_attended: number;
  open_events: EventOut[];
}

export interface DonorOut {
  donor_id: number;
  name: string;
  email: string;
  phone_number: string | null;
  is_registered: boolean;
  created_at: ISODateTime;
}
export interface DonorSummary extends DonorOut {
  total_donated: Money;
  donation_count: number;
}
export interface CampaignContribution {
  campaign_id: number;
  campaign_title: string;
  total_amount: Money;
  donation_count: number;
  last_donation_date: ISODateTime;
}
export interface DonorDetail extends DonorSummary {
  by_campaign: CampaignContribution[];
  donations: DonationOut[];
}
export interface DuplicateGroup {
  email: string;
  donors: DonorSummary[];
}
export interface DonorDashboard {
  donor: DonorSummary;
  recent_donations: DonationOut[];
  featured_campaigns: CampaignOut[];
}

export interface UtilizationOut {
  utilization_id: number;
  campaign_id: number;
  category: string;
  amount: Money;
  description: string;
  reference_number: string;
  utilization_date: ISODate;
  recorded_by: number;
  recorded_by_name: string;
  recorded_date: ISODateTime;
}
export interface FundReport {
  campaign_id: number;
  campaign_title: string;
  campaign_status: CampaignStatus;
  total_raised: Money;
  total_utilized: Money;
  remaining_balance: Money;
  breakdown: { category: string; amount: Money; entries: number; percent_of_utilized: number }[];
  entries: UtilizationOut[];
  generated_at: ISODateTime;
}
export interface AdminDashboard {
  total_raised: Money;
  total_utilized: Money;
  total_remaining: Money;
  campaigns: { draft: number; active: number; closed: number };
  total_donors: number;
  pending_volunteers: number;
  approved_volunteers: number;
  upcoming_events: number;
  recent_donations: DonationOut[];
}

export interface AuditLogOut {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: ISODateTime;
}
export interface EmailLogOut {
  id: number;
  to_email: string;
  subject: string;
  kind: string;
  status: "sent" | "skipped" | "failed";
  error: string | null;
  created_at: ISODateTime;
}

export interface MetaConfig {
  ngo_name: string;
  currency: string;
  max_single_donation: Money;
  payment_methods: PaymentMethod[];
  campaign_statuses: string[];
  donation_statuses: string[];
  event_statuses: string[];
  volunteer_statuses: string[];
  attendance_statuses: string[];
  suggested_campaign_categories: string[];
  suggested_utilization_categories: string[];
  suggested_volunteer_interests: string[];
  payment_simulation_allows_forced_outcome: boolean;
}
export interface FaqItem {
  topic: string;
  question: string;
  answer: string;
}
