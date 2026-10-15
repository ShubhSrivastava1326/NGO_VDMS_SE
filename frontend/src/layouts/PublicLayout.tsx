import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { motion, useScroll } from "motion/react";
import { homeFor, useAuth } from "@/auth/AuthContext";
import { useMeta } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { Button, ButtonLink, IconButton } from "@/ui/Button";
import { Logo } from "@/ui/Logo";
import { SmoothScroll } from "@/motion/SmoothScroll";

const nav = [
  { to: "/campaigns", label: "Our causes" },
  { to: "/events", label: "Volunteer" },
  { to: "/#impact", label: "Our impact" },
  { to: "/#about", label: "About us" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative rounded-full px-3.5 py-2 text-[0.95rem] font-semibold transition-colors",
    isActive ? "text-berry-800" : "text-ink-2 hover:text-berry-700",
  );

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user, logout } = useAuth();
  const { data: meta } = useMeta();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="drawer" aria-label="Menu" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="flex h-full flex-col px-5 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <Logo name={meta?.ngo_name?.replace(/ NGO$/, "")} />
            <IconButton label="Close menu" onClick={onClose}><X className="size-5" /></IconButton>
          </div>
          <nav className="mt-8 flex flex-col" aria-label="Main">
            {[{ to: "/", label: "Home" }, ...nav].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={onClose}
                className={({ isActive }) => cn("border-b border-line py-4 font-display text-2xl", isActive ? "text-berry-700" : "text-ink")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3 pt-8">
            {user ? (
              <>
                <ButtonLink to={homeFor(user.role)} onClick={onClose} className="w-full" icon={<LayoutDashboard className="size-4" />}>My dashboard</ButtonLink>
                <Button variant="secondary" className="w-full" icon={<LogOut className="size-4" />} onClick={() => { logout(); onClose(); }}>Sign out</Button>
              </>
            ) : (
              <>
                <ButtonLink to="/campaigns" onClick={onClose} className="w-full">Donate now</ButtonLink>
                <ButtonLink to="/login" variant="secondary" onClick={onClose} className="w-full">Sign in</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { data: meta } = useMeta();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <header className={cn("public-header", scrolled && "is-scrolled")}>
      <motion.div className="reading-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      <div className="container-page header-inner">
        <Logo name={meta?.ngo_name?.replace(/ NGO$/, "")} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((n) => n.to.includes("#") ? <Link key={n.to} to={n.to} className={linkClass({ isActive: false })}>{n.label}</Link> : <NavLink key={n.to} to={n.to} className={linkClass}>{n.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <ButtonLink to={homeFor(user.role)} variant="soft" size="sm" icon={<LayoutDashboard className="size-4" />}>My dashboard</ButtonLink>
              <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="size-4" />}>Sign out</Button>
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink to="/campaigns" className="header-donate motion-button">Donate now</ButtonLink>
            </>
          )}
        </div>
        <IconButton label="Open menu" aria-expanded={open} aria-haspopup="dialog" className="lg:hidden" onClick={() => setOpen(true)}><Menu className="size-6" /></IconButton>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </header>
  );
}

function Footer() {
  const { data: meta } = useMeta();
  const col = "space-y-2.5 text-[0.95rem]";
  const a = "footer-link";
  return (
    <footer className="public-footer">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo name={meta?.ngo_name?.replace(/ NGO$/, "")} />
          <p className="mt-4 text-[0.95rem] text-ink-3">
            Connecting people who care with causes that matter. A little kindness, a lasting difference.
          </p>
        </div>
        <div>
          <p className="section-kicker">Make a difference</p>
          <ul className={cn("mt-3", col)}>
            <li><Link className={a} to="/campaigns">Active campaigns</Link></li>
            <li><Link className={a} to="/register/donor">Create a donor account</Link></li>
            <li><Link className={a} to="/help">Help &amp; FAQ</Link></li>
          </ul>
        </div>
        <div>
          <p className="section-kicker">Give your time</p>
          <ul className={cn("mt-3", col)}>
            <li><Link className={a} to="/events">Upcoming events</Link></li>
            <li><Link className={a} to="/register/volunteer">Become a volunteer</Link></li>
          </ul>
        </div>
        <div>
          <p className="section-kicker">Stay connected</p>
          <ul className={cn("mt-3", col)}>
            <li><Link className={a} to="/login">Sign in</Link></li>
            <li><Link className={a} to="/help">Questions & answers</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-[0.75rem] text-ink-3">
          Made for a kinder tomorrow. · Demonstration platform: payments are simulated; no money is charged.
        </p>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="public-shell">
      <SmoothScroll />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-berry-700 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="route-in outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
