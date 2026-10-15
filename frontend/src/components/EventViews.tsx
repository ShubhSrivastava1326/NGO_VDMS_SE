import { Link, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, MapPin } from "lucide-react";
import { eventApi } from "@/api/services";
import type { EventOut, RegistrationOut } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { cn, dayNum, fmtDateTime, hasPassed, monthShort, weekday } from "@/lib/format";
import { StatusPill } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { SlotDots } from "@/ui/SlotDots";
import { useToast } from "@/ui/Toast";

/** The date as a ledger block: big day number, month in mono. */
export function DateBlock({ iso, tone = "light" }: { iso: string; tone?: "light" | "dark" }) {
  return (
    <div className={cn("w-[4.25rem] shrink-0 border-t-[3px] pt-2 text-center", tone === "dark" ? "border-blush-300" : "border-berry-700")}>
      <p className={cn("folio !text-[0.68rem]", tone === "dark" && "!text-blush-300")}>{weekday(iso)}</p>
      <p className={cn("display text-[2.5rem] tabular-nums leading-none", tone === "dark" && "text-white")}>{dayNum(iso)}</p>
      <p className={cn("folio mt-1 !text-berry-700", tone === "dark" && "!text-blush-200")}>{monthShort(iso)}</p>
    </div>
  );
}

/**
 * Sign-up control: the rules of the integration guide (section 7), evaluated top to bottom.
 * The server enforces every rule again; this only avoids pointless error toasts.
 */
export function EventSignupButton({ event, size = "md", showHint = true }: { event: EventOut; size?: "sm" | "md" | "lg"; showHint?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const loc = useLocation();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["event", event.event_id] });
    qc.invalidateQueries({ queryKey: ["volunteer"] });
  };
  const signup = useMutation({
    mutationFn: () => eventApi.signup(event.event_id),
    onSuccess: () => { toast.success(`You're signed up for ${event.title}.`); refresh(); },
    onError: (e) => { toast.fail(e); refresh(); }, // e.g. EVENT_FULL won the race: show the truth
  });
  const withdraw = useMutation({
    mutationFn: () => eventApi.withdraw(event.event_id),
    onSuccess: () => { toast.info("You've been removed from this event."); refresh(); },
    onError: (e) => { toast.fail(e); refresh(); },
  });

  const over = event.status === "completed" || hasPassed(event.event_date);
  if (event.status === "cancelled") return <StatusPill status="cancelled" />;
  if (over) return <Button size={size} variant="secondary" disabled>Event ended</Button>;

  if (!user) {
    return <ButtonLink to="/login" state={{ from: loc.pathname }} size={size}>Log in to sign up</ButtonLink>;
  }
  if (user.role !== "volunteer") {
    return showHint ? <p className="text-sm text-ink-3">Only volunteer accounts can sign up for events.</p> : null;
  }
  if (user.volunteer_status === "pending") {
    return (
      <div className="space-y-1.5">
        <Button size={size} disabled>Awaiting approval</Button>
        {showHint && <p className="text-sm text-ink-3">You can sign up once an admin approves your account.</p>}
      </div>
    );
  }
  if (user.volunteer_status === "deactivated") {
    return (
      <div className="space-y-1.5">
        <Button size={size} disabled>Account deactivated</Button>
        {showHint && <p className="text-sm text-ink-3">Please contact the NGO team.</p>}
      </div>
    );
  }
  if (event.my_registration) {
    return (
      <div className="space-y-1.5">
        <Button size={size} variant="secondary" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>Withdraw</Button>
        {showHint && (
          <p className="text-sm font-medium text-teal-800">
            You're signed up{event.my_registration.task ? ` · Task: ${event.my_registration.task}` : ""}
          </p>
        )}
      </div>
    );
  }
  if (event.is_full) return <Button size={size} disabled>Event full</Button>;
  return <Button size={size} loading={signup.isPending} onClick={() => signup.mutate()}>Sign up</Button>;
}

/** A row in the event list. */
export function EventRow({ event: e, tone = "light", level = "h3" }: { event: EventOut; tone?: "light" | "dark"; level?: "h2" | "h3" }) {
  const Heading = level;
  return (
    <article className={cn("grid gap-x-8 gap-y-4 border-t py-6 md:grid-cols-[4.5rem_minmax(0,1fr)_14rem_auto] md:items-center", tone === "dark" ? "border-berry-800" : "border-line-strong")}>
      <DateBlock iso={e.event_date} tone={tone} />
      <div className="min-w-0">
        <Heading className={cn("text-[clamp(1.3rem,2.2vw,1.8rem)] leading-tight", tone === "dark" && "text-white")}>
          <Link to={`/events/${e.event_id}`} className="hover:underline hover:decoration-1 hover:underline-offset-4">{e.title}</Link>
        </Heading>
        <p className={cn("mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", tone === "dark" ? "text-blush-200" : "text-ink-2")}>
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" />{fmtDateTime(e.event_date)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{e.location}</span>
        </p>
      </div>
      <div>
        <SlotDots registered={e.registered_count} required={e.volunteers_required} />
        <p className={cn("num mt-1.5 text-xs", tone === "dark" ? "text-blush-300" : "text-ink-3")}>
          {e.is_full ? "Fully subscribed" : `${e.slots_remaining} of ${e.volunteers_required} slots open`}
        </p>
      </div>
      <div className="md:justify-self-end">
        {tone === "dark" ? <ButtonLink to={`/events/${e.event_id}`} variant="onDark" size="sm">View event</ButtonLink> : <EventSignupButton event={e} size="sm" showHint={false} />}
      </div>
    </article>
  );
}

/** One of the volunteer's own sign-ups (tasks / history). */
export function RegistrationRow({ reg }: { reg: RegistrationOut }) {
  return (
    <article className="grid gap-x-6 gap-y-3 border-t border-line-strong py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center">
      <DateBlock iso={reg.event.event_date} />
      <div className="min-w-0">
        <h3 className="text-xl leading-tight"><Link className="hover:underline hover:underline-offset-4" to={`/events/${reg.event.event_id}`}>{reg.event.title}</Link></h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" />{fmtDateTime(reg.event.event_date)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{reg.event.location}</span>
        </p>
        <p className="mt-2 text-[0.95rem]">
          <span className="folio mr-2">Task</span>
          {reg.task ? <strong className="font-semibold">{reg.task}</strong> : <span className="text-ink-3">Not assigned yet</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <StatusPill status={reg.attendance_status} />
        {reg.event.status !== "published" && reg.event.status !== "completed" && <StatusPill status={reg.event.status} />}
      </div>
    </article>
  );
}
