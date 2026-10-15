import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { ExternalLink, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useMeta } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { Button, IconButton } from "@/ui/Button";
import { Logo } from "@/ui/Logo";

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; group?: string }

const roleLabel = { admin: "NGO staff", volunteer: "Volunteer", donor: "Donor" } as const;

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  let lastGroup: string | undefined;
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-0.5">
      {items.map((it) => {
        const heading = it.group && it.group !== lastGroup ? it.group : null;
        lastGroup = it.group;
        return (
          <div key={it.to}>
            {heading && <p className="folio mb-1 mt-5 px-3">{heading}</p>}
            <NavLink
              to={it.to}
              end={it.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[0.95rem] font-semibold transition-colors",
                  isActive ? "bg-blush-100 text-berry-800" : "text-ink-2 hover:bg-blush-50 hover:text-berry-700",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-berry-700" />}
                  <it.icon className="size-[1.15rem] shrink-0" aria-hidden="true" />
                  {it.label}
                </>
              )}
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}

function Account({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="px-1">
        <p className="truncate text-[0.95rem] font-semibold text-ink">{user.full_name}</p>
        <p className="truncate text-sm text-ink-3">{user.email}</p>
        <p className="folio mt-1.5">{roleLabel[user.role]}</p>
      </div>
      <div className="flex gap-2">
        <Link to="/" onClick={onNavigate} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong text-sm font-semibold text-ink-2 hover:bg-blush-100">
          <ExternalLink className="size-4" aria-hidden="true" />Public site
        </Link>
        <Button variant="ghost" size="md" icon={<LogOut className="size-4" />} onClick={logout} className="flex-1">Sign out</Button>
      </div>
    </div>
  );
}

export function DashboardLayout({ items, banner }: { items: NavItem[]; banner?: ReactNode }) {
  const { data: meta } = useMeta();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const loc = useLocation();
  const name = meta?.ngo_name?.replace(/ NGO$/, "");

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-berry-700 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-4 pb-5 pt-5 lg:flex">
        <Logo name={name} className="px-2" />
        <div className="mt-6 flex-1 overflow-y-auto"><NavList items={items} /></div>
        <Account />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <Logo name={name} />
        <IconButton label="Open navigation" onClick={() => setOpen(true)}><Menu className="size-6" /></IconButton>
      </div>
      <dialog ref={drawer} className="drawer" aria-label="Navigation" onClose={() => setOpen(false)} onClick={(e) => e.target === drawer.current && setOpen(false)}>
        {open && (
          <div className="flex h-full flex-col px-4 pb-5 pt-4">
            <div className="flex items-center justify-between px-1">
              <Logo name={name} />
              <IconButton label="Close navigation" onClick={() => setOpen(false)}><X className="size-5" /></IconButton>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto"><NavList items={items} onNavigate={() => setOpen(false)} /></div>
            <Account onNavigate={() => setOpen(false)} />
          </div>
        )}
      </dialog>

      <div className="min-w-0">
        {banner}
        <main id="main" tabIndex={-1} className="route-in mx-auto w-full max-w-6xl px-5 py-8 outline-none sm:px-8 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
