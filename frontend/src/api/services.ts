// The single place that knows endpoint paths. Every path, verb and field name below comes from
// docs/FRONTEND_INTEGRATION_GUIDE.md section 11; no endpoint is invented.
import { api, download } from "./client";
import type {
  AdminDashboard, AttendanceStatus, AuditLogOut, AuthResponse, CampaignOut, CampaignStatus, DonationCreateBody,
  DonationInitiated, DonationOut, DonationStatus, DonorDashboard, DonorDetail, DonorOut, DonorSummary,
  DuplicateGroup, EmailLogOut, EventOut, EventStatus, FaqItem, FundReport, MetaConfig, Page, ReceiptOut,
  RegistrationOut, RosterEntry, UserOut, UtilizationOut, VolunteerAdminDetail, VolunteerDashboard,
  VolunteerOut, VolunteerStatus,
} from "./types";

export interface PageParams { page?: number; page_size?: number }
const json = (method: "POST" | "PATCH", body?: unknown) => ({ method, body: body ?? {} });
const tokenHeader = (token?: string | null) => (token ? { "X-Donation-Token": token } : undefined);

// --- Auth --------------------------------------------------------------------------------------
export interface VolunteerRegisterBody {
  name: string; email: string; password: string; phone_number: string;
  areas_of_interest: string[]; availability?: string;
}
export interface DonorRegisterBody { name: string; email: string; password: string; phone_number?: string }

export const authApi = {
  login: (email: string, password: string) => api<AuthResponse>("/auth/login", json("POST", { email, password })),
  registerVolunteer: (b: VolunteerRegisterBody) => api<AuthResponse>("/auth/register/volunteer", json("POST", b)),
  registerDonor: (b: DonorRegisterBody) => api<AuthResponse>("/auth/register/donor", json("POST", b)),
  me: () => api<UserOut>("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    api<{ detail: string }>("/auth/change-password", json("POST", { current_password, new_password })),
};

// --- Meta ------------------------------------------------------------------------------------------
export const metaApi = {
  config: () => api<MetaConfig>("/meta/config"),
  faq: () => api<FaqItem[]>("/meta/faq"),
};

// --- Public campaigns -------------------------------------------------------------------------------
export interface CampaignListParams extends PageParams {
  category?: string; q?: string; sort?: "newest" | "ending_soon" | "most_funded";
}
export const campaignApi = {
  list: (p: CampaignListParams = {}) => api<Page<CampaignOut>>("/campaigns", { params: { ...p } }),
  categories: () => api<string[]>("/campaigns/categories"),
  get: (id: number | string) => api<CampaignOut>(`/campaigns/${id}`),
};

// --- Donations (guest or donor) ------------------------------------------------------------------------
export const donationApi = {
  create: (b: DonationCreateBody) => api<DonationInitiated>("/donations", json("POST", b)),
  get: (id: number, token?: string | null) => api<DonationOut>(`/donations/${id}`, { headers: tokenHeader(token) }),
  confirm: (id: number, token?: string | null, simulate_outcome?: "success" | "failure") =>
    api<DonationOut>(`/donations/${id}/confirm`, { ...json("POST", simulate_outcome ? { simulate_outcome } : {}), headers: tokenHeader(token) }),
  cancel: (id: number, token?: string | null) =>
    api<DonationOut>(`/donations/${id}/cancel`, { method: "POST", headers: tokenHeader(token) }),
  retry: (id: number, token?: string | null) =>
    api<DonationInitiated>(`/donations/${id}/retry`, { method: "POST", headers: tokenHeader(token) }),
  receipt: (id: number, token?: string | null) => api<ReceiptOut>(`/donations/${id}/receipt`, { headers: tokenHeader(token) }),
  downloadReceiptPdf: (id: number, token?: string | null, name = "receipt.pdf") =>
    download(`/donations/${id}/receipt.pdf`, { headers: tokenHeader(token) }, name),
};

// --- Events (public + volunteer) --------------------------------------------------------------------------
export const eventApi = {
  list: (p: PageParams & { q?: string; include_past?: boolean } = {}) => api<Page<EventOut>>("/events", { params: { ...p } }),
  get: (id: number | string) => api<EventOut>(`/events/${id}`),
  signup: (id: number) => api<RegistrationOut>(`/events/${id}/signup`, { method: "POST" }),
  withdraw: (id: number) => api<{ detail: string }>(`/events/${id}/signup`, { method: "DELETE" }),
};

// --- Volunteer (self) -------------------------------------------------------------------------------------
export interface VolunteerUpdateBody { name?: string; phone_number?: string; areas_of_interest?: string[]; availability?: string }
export const volunteerApi = {
  me: () => api<VolunteerOut>("/volunteers/me"),
  update: (b: VolunteerUpdateBody) => api<VolunteerOut>("/volunteers/me", json("PATCH", b)),
  tasks: () => api<RegistrationOut[]>("/volunteers/me/tasks"),
  history: () => api<RegistrationOut[]>("/volunteers/me/history"),
  dashboard: () => api<VolunteerDashboard>("/volunteers/me/dashboard"),
};

// --- Donor (self) ----------------------------------------------------------------------------------------------
export const donorApi = {
  me: () => api<DonorSummary>("/donors/me"),
  update: (b: { name?: string; phone_number?: string }) => api<DonorOut>("/donors/me", json("PATCH", b)),
  donations: (p: PageParams & { status?: DonationStatus } = {}) => api<Page<DonationOut>>("/donors/me/donations", { params: { ...p } }),
  dashboard: () => api<DonorDashboard>("/donors/me/dashboard"),
};

// --- Admin -------------------------------------------------------------------------------------------------------
export interface CampaignBody {
  title: string; description: string; category: string; goal_amount: string; start_date: string; end_date: string;
}
export interface UtilizationBody {
  category: string; amount: string; description: string; reference_number: string; utilization_date?: string;
}
export interface EventBody {
  title: string; description: string; event_date: string; location: string; volunteers_required: number;
}

export const adminApi = {
  dashboard: () => api<AdminDashboard>("/admin/dashboard"),

  campaigns: (p: PageParams & { status?: CampaignStatus; q?: string } = {}) => api<Page<CampaignOut>>("/admin/campaigns", { params: { ...p } }),
  campaign: (id: number | string) => api<CampaignOut>(`/admin/campaigns/${id}`),
  createCampaign: (b: CampaignBody) => api<CampaignOut>("/admin/campaigns", json("POST", b)),
  updateCampaign: (id: number, b: Partial<CampaignBody>) => api<CampaignOut>(`/admin/campaigns/${id}`, json("PATCH", b)),
  publishCampaign: (id: number) => api<CampaignOut>(`/admin/campaigns/${id}/publish`, { method: "POST" }),
  closeCampaign: (id: number) => api<CampaignOut>(`/admin/campaigns/${id}/close`, { method: "POST" }),
  utilizations: (id: number) => api<UtilizationOut[]>(`/admin/campaigns/${id}/utilizations`),
  recordUtilization: (id: number, b: UtilizationBody) => api<UtilizationOut>(`/admin/campaigns/${id}/utilizations`, json("POST", b)),
  fundReport: (id: number) => api<FundReport>(`/admin/campaigns/${id}/fund-report`),
  exportFundReport: (id: number, format: "pdf" | "csv") =>
    download(`/admin/campaigns/${id}/fund-report/export`, { params: { format } }, `fund-report-campaign-${id}.${format}`),

  events: (p: PageParams & { status?: EventStatus; q?: string } = {}) => api<Page<EventOut>>("/admin/events", { params: { ...p } }),
  event: (id: number | string) => api<EventOut>(`/admin/events/${id}`),
  createEvent: (b: EventBody) => api<EventOut>("/admin/events", json("POST", b)),
  updateEvent: (id: number, b: Partial<EventBody>) => api<EventOut>(`/admin/events/${id}`, json("PATCH", b)),
  publishEvent: (id: number) => api<EventOut>(`/admin/events/${id}/publish`, { method: "POST" }),
  cancelEvent: (id: number) => api<EventOut>(`/admin/events/${id}/cancel`, { method: "POST" }),
  roster: (id: number) => api<RosterEntry[]>(`/admin/events/${id}/registrations`),
  updateRegistration: (eventId: number, regId: number, b: { task?: string; attendance_status?: AttendanceStatus }) =>
    api<RosterEntry>(`/admin/events/${eventId}/registrations/${regId}`, json("PATCH", b)),
  markAttendance: (eventId: number, records: { registration_id: number; attendance_status: AttendanceStatus }[]) =>
    api<RosterEntry[]>(`/admin/events/${eventId}/attendance`, json("POST", { records })),

  volunteers: (p: PageParams & { status?: VolunteerStatus; q?: string } = {}) => api<Page<VolunteerOut>>("/admin/volunteers", { params: { ...p } }),
  volunteer: (id: number | string) => api<VolunteerAdminDetail>(`/admin/volunteers/${id}`),
  approveVolunteer: (id: number) => api<VolunteerOut>(`/admin/volunteers/${id}/approve`, { method: "POST" }),
  deactivateVolunteer: (id: number) => api<VolunteerOut>(`/admin/volunteers/${id}/deactivate`, { method: "POST" }),

  donors: (p: PageParams & { q?: string } = {}) => api<Page<DonorSummary>>("/admin/donors", { params: { ...p } }),
  donor: (id: number | string) => api<DonorDetail>(`/admin/donors/${id}`),
  duplicates: () => api<DuplicateGroup[]>("/admin/donors/duplicates"),
  mergeDonors: (primary_donor_id: number, duplicate_donor_ids: number[]) =>
    api<DonorSummary>("/admin/donors/merge", json("POST", { primary_donor_id, duplicate_donor_ids })),

  donations: (p: PageParams & { campaign_id?: number; donor_id?: number; status?: DonationStatus } = {}) =>
    api<Page<DonationOut>>("/admin/donations", { params: { ...p } }),
  auditLog: (p: PageParams & { entity_type?: string; action?: string } = {}) => api<Page<AuditLogOut>>("/admin/audit-log", { params: { ...p } }),
  emailLog: (p: PageParams = {}) => api<Page<EmailLogOut>>("/admin/email-log", { params: { ...p } }),
  createAdmin: (b: { name: string; email: string; password: string }) => api<UserOut>("/admin/admins", json("POST", b)),
};
