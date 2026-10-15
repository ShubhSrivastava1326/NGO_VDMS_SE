import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  CalendarDays, ClipboardList, HandHeart, HeartHandshake, History, LayoutDashboard, Mail, Megaphone, Receipt, ScrollText,
  ShieldCheck, User, Users,
} from "lucide-react";
import { homeFor, useAuth } from "@/auth/AuthContext";
import { RequireRole } from "@/auth/RequireRole";
import { VolunteerBanner } from "@/components/VolunteerBanner";
import { DashboardLayout, type NavItem } from "@/layouts/DashboardLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { PageSpinner } from "@/ui/States";

// public pages (kept in the main bundle: first paint of the site matters most)
import Home from "@/pages/public/Home";
import Campaigns from "@/pages/public/Campaigns";
import CampaignDetail from "@/pages/public/CampaignDetail";
import Donate from "@/pages/public/Donate";
import Receipt_ from "@/pages/public/Receipt";
import { Events, EventDetail } from "@/pages/public/Events";
import Help from "@/pages/public/Help";
import { Login, RegisterDonor, RegisterVolunteer } from "@/pages/public/Auth";
import NotFound from "@/pages/public/NotFound";

// role areas are code-split so visitors never download dashboard code
function named<T extends Record<string, ComponentType>>(loader: () => Promise<T>, key: keyof T) {
  return lazy(() => loader().then((m) => ({ default: m[key] })));
}
const DonorDashboard = named(() => import("@/pages/donor/Donor"), "DonorDashboard");
const DonorDonations = named(() => import("@/pages/donor/Donor"), "DonorDonations");
const DonorProfile = named(() => import("@/pages/donor/Donor"), "DonorProfile");
const VolunteerDashboard = named(() => import("@/pages/volunteer/Volunteer"), "VolunteerDashboard");
const VolunteerTasks = named(() => import("@/pages/volunteer/Volunteer"), "VolunteerTasks");
const VolunteerHistory = named(() => import("@/pages/volunteer/Volunteer"), "VolunteerHistory");
const VolunteerProfile = named(() => import("@/pages/volunteer/Volunteer"), "VolunteerProfile");
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminCampaigns = named(() => import("@/pages/admin/Campaigns"), "AdminCampaigns");
const AdminCampaignNew = named(() => import("@/pages/admin/Campaigns"), "AdminCampaignNew");
const AdminCampaignDetail = named(() => import("@/pages/admin/Campaigns"), "AdminCampaignDetail");
const AdminEvents = named(() => import("@/pages/admin/Events"), "AdminEvents");
const AdminEventNew = named(() => import("@/pages/admin/Events"), "AdminEventNew");
const AdminEventDetail = named(() => import("@/pages/admin/Events"), "AdminEventDetail");
const AdminVolunteers = named(() => import("@/pages/admin/People"), "AdminVolunteers");
const AdminVolunteerDetail = named(() => import("@/pages/admin/People"), "AdminVolunteerDetail");
const AdminDonors = named(() => import("@/pages/admin/People"), "AdminDonors");
const AdminDonorDetail = named(() => import("@/pages/admin/People"), "AdminDonorDetail");
const AdminDuplicates = named(() => import("@/pages/admin/People"), "AdminDuplicates");
const AdminDonations = named(() => import("@/pages/admin/Logs"), "AdminDonations");
const AdminAudit = named(() => import("@/pages/admin/Logs"), "AdminAudit");
const AdminEmails = named(() => import("@/pages/admin/Logs"), "AdminEmails");
const AdminStaff = named(() => import("@/pages/admin/Logs"), "AdminStaff");

const adminNav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone, group: "Fundraising" },
  { to: "/admin/donations", label: "Donations", icon: Receipt, group: "Fundraising" },
  { to: "/admin/donors", label: "Donors", icon: HeartHandshake, group: "People" },
  { to: "/admin/volunteers", label: "Volunteers", icon: Users, group: "People" },
  { to: "/admin/events", label: "Events", icon: CalendarDays, group: "Operations" },
  { to: "/admin/audit-log", label: "Audit log", icon: ScrollText, group: "System" },
  { to: "/admin/email-log", label: "E-mail log", icon: Mail, group: "System" },
  { to: "/admin/staff", label: "Staff", icon: ShieldCheck, group: "System" },
];
const volunteerNav: NavItem[] = [
  { to: "/volunteer", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/volunteer/tasks", label: "My tasks", icon: ClipboardList },
  { to: "/volunteer/history", label: "History", icon: History },
  { to: "/volunteer/profile", label: "Profile", icon: User },
  { to: "/events", label: "Browse events", icon: CalendarDays },
];
const donorNav: NavItem[] = [
  { to: "/donor", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/donor/donations", label: "Donations", icon: Receipt },
  { to: "/donor/profile", label: "Profile", icon: User },
  { to: "/campaigns", label: "Browse causes", icon: HandHeart },
];

function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      } else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, key]);
  return null;
}

/** Sign-in / registration pages bounce signed-in users to where they belong. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageSpinner label="Checking your session" />;
  if (user) return <Navigate to={(loc.state as { from?: string } | null)?.from ?? homeFor(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="campaigns/:id/donate" element={<Donate />} />
            <Route path="donations/:id/receipt" element={<Receipt_ />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="help" element={<Help />} />
            <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="register/volunteer" element={<GuestOnly><RegisterVolunteer /></GuestOnly>} />
            <Route path="register/donor" element={<GuestOnly><RegisterDonor /></GuestOnly>} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/donor" element={<RequireRole roles={["donor"]}><DashboardLayout items={donorNav} /></RequireRole>}>
            <Route index element={<DonorDashboard />} />
            <Route path="donations" element={<DonorDonations />} />
            <Route path="profile" element={<DonorProfile />} />
          </Route>

          <Route path="/volunteer" element={<RequireRole roles={["volunteer"]}><DashboardLayout items={volunteerNav} banner={<VolunteerBanner />} /></RequireRole>}>
            <Route index element={<VolunteerDashboard />} />
            <Route path="tasks" element={<VolunteerTasks />} />
            <Route path="history" element={<VolunteerHistory />} />
            <Route path="profile" element={<VolunteerProfile />} />
          </Route>

          <Route path="/admin" element={<RequireRole roles={["admin"]}><DashboardLayout items={adminNav} /></RequireRole>}>
            <Route index element={<AdminDashboard />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="campaigns/new" element={<AdminCampaignNew />} />
            <Route path="campaigns/:id" element={<AdminCampaignDetail />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="events/new" element={<AdminEventNew />} />
            <Route path="events/:id" element={<AdminEventDetail />} />
            <Route path="volunteers" element={<AdminVolunteers />} />
            <Route path="volunteers/:id" element={<AdminVolunteerDetail />} />
            <Route path="donors" element={<AdminDonors />} />
            <Route path="donors/duplicates" element={<AdminDuplicates />} />
            <Route path="donors/:id" element={<AdminDonorDetail />} />
            <Route path="donations" element={<AdminDonations />} />
            <Route path="audit-log" element={<AdminAudit />} />
            <Route path="email-log" element={<AdminEmails />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
