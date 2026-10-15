import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { CalendarPlus, Check, ExternalLink, Users } from "lucide-react";
import { ApiError } from "@/api/client";
import { adminApi, type EventBody } from "@/api/services";
import type { AttendanceStatus, EventOut, EventStatus, RosterEntry } from "@/api/types";
import { useDebounced, usePageTitle } from "@/lib/hooks";
import { fmtDateTime, hasPassed, isoToLocalInput, localInputToIso } from "@/lib/format";
import { StatusPill } from "@/ui/Badge";
import { Button, ButtonLink, IconButton } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { SearchInput, TextAreaField, TextField } from "@/ui/Fields";
import { PageHeader, SectionHead } from "@/ui/PageHeader";
import { Pagination } from "@/ui/Pagination";
import { EmptyState, ErrorState, FormError, Skeleton, SkeletonRows } from "@/ui/States";
import { SlotDots } from "@/ui/SlotDots";
import { Tabs } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";

// ------------------------------------------------------------------------------------- list
export function AdminEvents() {
  usePageTitle("Events");
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as EventStatus | null) ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q, 350);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (dq !== (params.get("q") ?? "")) set({ q: dq || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const list = useQuery({
    queryKey: ["admin", "events", { status, page, q: params.get("q") ?? "" }],
    queryFn: () => adminApi.events({ status: status || undefined, page, page_size: 15, q: params.get("q") || undefined }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader folio="§ Admin · Events" title="Events" description="Create events, publish them for sign-up, assign tasks and record attendance."
        actions={<ButtonLink to="/admin/events/new" icon={<CalendarPlus className="size-4" />}>New event</ButtonLink>} />
      <Tabs label="Event status" value={status || "all"} onChange={(v) => set({ status: v === "all" ? null : v })}
        tabs={[{ id: "all", label: "All" }, { id: "draft", label: "Draft" }, { id: "published", label: "Published" }, { id: "completed", label: "Completed" }, { id: "cancelled", label: "Cancelled" }]} />
      <div className="my-6 max-w-md"><SearchInput label="Search events" placeholder="Search by title or location" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {list.isLoading && <SkeletonRows rows={5} className="h-14" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState icon={<CalendarPlus className="size-5" />} title="No events found" action={<ButtonLink to="/admin/events/new">Create an event</ButtonLink>}>Nothing matches this view.</EmptyState>}
      {list.data && list.data.items.length > 0 && (
        <>
          <table className="ledger">
            <thead><tr><th scope="col">Event</th><th scope="col">When</th><th scope="col">Status</th><th scope="col">Volunteers</th></tr></thead>
            <tbody>
              {list.data.items.map((e) => (
                <tr key={e.event_id}>
                  <td data-label="Event">
                    <Link to={`/admin/events/${e.event_id}`} className="font-semibold hover:text-berry-700 hover:underline">{e.title}</Link>
                    <p className="text-sm text-ink-3">{e.location}</p>
                  </td>
                  <td data-label="When" className="num whitespace-nowrap text-sm">{fmtDateTime(e.event_date)}</td>
                  <td data-label="Status"><StatusPill status={e.status} /></td>
                  <td data-label="Volunteers">
                    <div className="flex flex-col items-end gap-1 md:items-start"><SlotDots registered={e.registered_count} required={e.volunteers_required} /><span className="num text-xs text-ink-3">{e.registered_count} / {e.volunteers_required}</span></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} noun="events" onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------- form
interface EventFormValues { title: string; description: string; event_date: string; location: string; volunteers_required: string }
const EV_FIELDS = ["title", "description", "event_date", "location", "volunteers_required"] as const;

function EventForm({ event, onSaved }: { event?: EventOut; onSaved: (e: EventOut) => void }) {
  const toast = useToast();
  const readOnly = event?.status === "cancelled" || event?.status === "completed";
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, dirtyFields } } = useForm<EventFormValues>({
    values: event
      ? { title: event.title, description: event.description, event_date: isoToLocalInput(event.event_date), location: event.location, volunteers_required: String(event.volunteers_required) }
      : { title: "", description: "", event_date: "", location: "", volunteers_required: "5" },
  });

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      let saved: EventOut;
      if (!event) {
        const body: EventBody = { title: v.title.trim(), description: v.description.trim(), event_date: localInputToIso(v.event_date), location: v.location.trim(), volunteers_required: Number(v.volunteers_required) };
        saved = await adminApi.createEvent(body);
        toast.success("Event created as a draft.");
      } else {
        const patch: Partial<EventBody> = {};
        if (dirtyFields.title) patch.title = v.title.trim();
        if (dirtyFields.description) patch.description = v.description.trim();
        if (dirtyFields.location) patch.location = v.location.trim();
        if (dirtyFields.event_date) patch.event_date = localInputToIso(v.event_date);
        if (dirtyFields.volunteers_required) patch.volunteers_required = Number(v.volunteers_required);
        if (Object.keys(patch).length === 0) { toast.info("Nothing to save."); return; }
        saved = await adminApi.updateEvent(event.event_id, patch);
        toast.success("Event updated.");
      }
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError) {
        let mapped = false;
        for (const [f, m] of Object.entries(e.fieldErrors)) {
          if ((EV_FIELDS as readonly string[]).includes(f)) { setError(f as keyof EventFormValues, { message: m }); mapped = true; }
        }
        if (!mapped) setFormError(e.message);
      } else setFormError("Something went wrong.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5">
      {readOnly && <p className="rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">A {event?.status} event can't be edited.</p>}
      <TextField label="Title" disabled={readOnly} maxLength={150} error={errors.title?.message}
        {...register("title", { required: "Enter a title", validate: (v) => v.trim() !== "" || "Enter a title" })} />
      <TextAreaField label="Description" rows={5} disabled={readOnly} error={errors.description?.message}
        {...register("description", { required: "Describe the event", validate: (v) => v.trim() !== "" || "Describe the event" })} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Date and time" type="datetime-local" disabled={readOnly} hint="In your local time." error={errors.event_date?.message}
          {...register("event_date", { required: "Choose a date and time", validate: (v) => !dirtyFields.event_date && event ? true : new Date(v).getTime() > Date.now() || "The event must be in the future" })} />
        <TextField label="Volunteers needed" type="number" min={event?.registered_count || 1} max={10000} inputMode="numeric" disabled={readOnly} error={errors.volunteers_required?.message}
          hint={event && event.registered_count > 0 ? `${event.registered_count} already signed up` : undefined}
          {...register("volunteers_required", {
            required: "Enter how many volunteers are needed",
            validate: (v) => {
              const n = Number(v);
              if (!Number.isInteger(n) || n < 1 || n > 10000) return "Enter a whole number from 1 to 10,000";
              if (event && n < event.registered_count) return `${event.registered_count} volunteers have already signed up`;
              return true;
            },
          })} />
      </div>
      <TextField label="Location" disabled={readOnly} maxLength={255} error={errors.location?.message}
        {...register("location", { required: "Enter a location", validate: (v) => v.trim() !== "" || "Enter a location" })} />
      <FormError>{formError}</FormError>
      {!readOnly && <Button type="submit" size="lg" loading={isSubmitting}>{event ? "Save changes" : "Create draft event"}</Button>}
    </form>
  );
}

export function AdminEventNew() {
  usePageTitle("New event");
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader back={{ to: "/admin/events", label: "Events" }} folio="§ Admin · Events" title={<>New <span className="emph">event</span></>} description="Events start as drafts. Publish one to open it for volunteer sign-up." />
      <EventForm onSaved={(e) => { qc.invalidateQueries({ queryKey: ["admin"] }); navigate(`/admin/events/${e.event_id}`); }} />
    </>
  );
}

// ------------------------------------------------------------------------------------ detail
export function AdminEventDetail() {
  const { id = "" } = useParams();
  const eid = Number(id);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "details";
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"publish" | "cancel" | null>(null);

  const q = useQuery({ queryKey: ["admin", "event", eid], queryFn: () => adminApi.event(eid) });
  const e = q.data;
  usePageTitle(e?.title ?? "Event");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["event", eid] }); };

  const publish = useMutation({ mutationFn: () => adminApi.publishEvent(eid), onSuccess: () => { toast.success("Event published. Volunteers can sign up."); refresh(); }, onError: toast.fail });
  const cancel = useMutation({ mutationFn: () => adminApi.cancelEvent(eid), onSuccess: () => { toast.success("Event cancelled."); refresh(); }, onError: toast.fail });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !e) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader
        back={{ to: "/admin/events", label: "Events" }}
        folio={`§ Admin · Event #${e.event_id}`}
        title={e.title}
        description={<span className="flex flex-wrap items-center gap-3"><StatusPill status={e.status} /><span className="num text-sm text-ink-2">{fmtDateTime(e.event_date)}</span></span>}
        actions={
          <>
            {e.status === "draft" && <Button onClick={() => setConfirm("publish")}>Publish event</Button>}
            {(e.status === "draft" || e.status === "published") && <Button variant="secondary" onClick={() => setConfirm("cancel")}>Cancel event</Button>}
            {e.status !== "draft" && <ButtonLink to={`/events/${e.event_id}`} variant="ghost" icon={<ExternalLink className="size-4" />}>Public page</ButtonLink>}
          </>
        }
      />
      <Tabs label="Event sections" panelId="event-panel" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[{ id: "details", label: "Details" }, { id: "roster", label: "Roster", count: e.registered_count }]} />
      <div className="pt-8" role="tabpanel" id="event-panel" aria-label={tab === "roster" ? "Roster" : "Details"}>
        {tab === "details" && <EventForm event={e} onSaved={refresh} />}
        {tab === "roster" && <Roster event={e} onChanged={refresh} />}
      </div>

      <ConfirmDialog open={confirm === "publish"} title="Publish this event?" confirmLabel="Publish" onClose={() => setConfirm(null)} onConfirm={() => publish.mutateAsync()}>
        It becomes visible to everyone and approved volunteers can sign up for the {e.volunteers_required} slots.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "cancel"} title="Cancel this event?" tone="danger" confirmLabel="Cancel event" onClose={() => setConfirm(null)} onConfirm={() => cancel.mutateAsync()}>
        {e.registered_count > 0
          ? <>All <strong>{e.registered_count}</strong> signed-up {e.registered_count === 1 ? "volunteer" : "volunteers"} will be e-mailed. Sign-up records are kept for history.</>
          : "No volunteers have signed up yet. The event will be marked as cancelled."}
      </ConfirmDialog>
    </>
  );
}

// ------------------------------------------------------------------------------------ roster
function TaskCell({ reg, eventId, disabled }: { reg: RosterEntry; eventId: number; disabled: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(reg.task ?? "");
  useEffect(() => setValue(reg.task ?? ""), [reg.task]);
  const changed = value.trim() !== (reg.task ?? "");
  const save = useMutation({
    mutationFn: () => adminApi.updateRegistration(eventId, reg.registration_id, { task: value.trim() }),
    onSuccess: () => { toast.success(`Task saved for ${reg.volunteer.name}.`); qc.invalidateQueries({ queryKey: ["admin", "roster", eventId] }); },
    onError: toast.fail,
  });
  return (
    <form className="flex items-center gap-1.5" onSubmit={(ev) => { ev.preventDefault(); if (changed && !save.isPending) save.mutate(); }}>
      <label className="sr-only" htmlFor={`task-${reg.registration_id}`}>Task for {reg.volunteer.name}</label>
      <input id={`task-${reg.registration_id}`} className="input !min-h-10 min-w-0 flex-1 !py-1.5 md:w-52" placeholder="e.g. Registration desk" maxLength={120} value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} />
      <IconButton type="submit" label={`Save task for ${reg.volunteer.name}`} disabled={!changed || save.isPending || disabled} className="!size-10 shrink-0 text-berry-700"><Check className="size-5" /></IconButton>
    </form>
  );
}

function Roster({ event, onChanged }: { event: EventOut; onChanged: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "roster", event.event_id], queryFn: () => adminApi.roster(event.event_id) });
  const [att, setAtt] = useState<Record<number, AttendanceStatus>>({});
  useEffect(() => {
    if (q.data) setAtt(Object.fromEntries(q.data.map((r) => [r.registration_id, r.attendance_status])));
  }, [q.data]);

  const cancelled = event.status === "cancelled";
  const canMark = !cancelled && (event.status === "published" || event.status === "completed") && hasPassed(event.event_date);
  const changed = (q.data ?? []).filter((r) => att[r.registration_id] && att[r.registration_id] !== r.attendance_status);

  const save = useMutation({
    mutationFn: () => adminApi.markAttendance(event.event_id, changed.map((r) => ({ registration_id: r.registration_id, attendance_status: att[r.registration_id] }))),
    onSuccess: () => { toast.success("Attendance saved."); qc.invalidateQueries({ queryKey: ["admin", "roster", event.event_id] }); onChanged(); },
    onError: toast.fail,
  });

  if (q.isLoading) return <SkeletonRows rows={4} className="h-14" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) return <EmptyState icon={<Users className="size-5" />} title="No volunteers yet">{event.status === "draft" ? "Publish the event so approved volunteers can sign up." : "Nobody has signed up so far."}</EmptyState>;

  return (
    <>
      <SectionHead
        title={`${q.data.length} of ${event.volunteers_required} slots filled`}
        action={canMark ? <Button loading={save.isPending} disabled={changed.length === 0} onClick={() => save.mutate()}>Save attendance{changed.length ? ` (${changed.length})` : ""}</Button> : undefined}
      />
      {!canMark && !cancelled && <p className="mb-5 rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">Attendance can be recorded after the event starts ({fmtDateTime(event.event_date)}). You can assign tasks at any time.</p>}
      {cancelled && <p className="mb-5 rounded-[var(--radius-sm)] bg-blush-50 px-4 py-3 text-sm text-ink-2">This event was cancelled, so tasks and attendance are read-only.</p>}
      <table className="ledger">
        <thead><tr><th scope="col">Volunteer</th><th scope="col">Task</th><th scope="col">Attendance</th><th scope="col">Signed up</th></tr></thead>
        <tbody>
          {q.data.map((r) => (
            <tr key={r.registration_id}>
              <td data-label="Volunteer">
                <Link to={`/admin/volunteers/${r.volunteer.volunteer_id}`} className="font-semibold hover:text-berry-700 hover:underline">{r.volunteer.name}</Link>
                <p className="num text-xs text-ink-3">{r.volunteer.email} · {r.volunteer.phone_number}</p>
              </td>
              <td data-label="Task" className="md:min-w-[17rem]"><TaskCell reg={r} eventId={event.event_id} disabled={cancelled} /></td>
              <td data-label="Attendance">
                {canMark ? (
                  <>
                    <label className="sr-only" htmlFor={`att-${r.registration_id}`}>Attendance for {r.volunteer.name}</label>
                    <select id={`att-${r.registration_id}`} className="input !min-h-10 !py-1.5 md:w-40" value={att[r.registration_id] ?? r.attendance_status} onChange={(e) => setAtt((a) => ({ ...a, [r.registration_id]: e.target.value as AttendanceStatus }))}>
                      <option value="registered">Registered</option>
                      <option value="attended">Attended</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </>
                ) : <StatusPill status={r.attendance_status} />}
              </td>
              <td data-label="Signed up" className="num whitespace-nowrap text-sm text-ink-3">{fmtDateTime(r.registered_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
