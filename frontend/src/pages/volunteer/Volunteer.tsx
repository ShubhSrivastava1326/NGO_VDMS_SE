import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { ArrowRight, CalendarX2, History } from "lucide-react";
import { ApiError } from "@/api/client";
import { volunteerApi } from "@/api/services";
import { useAuth } from "@/auth/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { EventRow, RegistrationRow } from "@/components/EventViews";
import { InterestPicker } from "@/components/InterestPicker";
import { useMeta, usePageTitle } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import { StatusPill } from "@/ui/Badge";
import { Button, ButtonLink } from "@/ui/Button";
import { TextAreaField, TextField } from "@/ui/Fields";
import { PageHeader, SectionHead, Stat } from "@/ui/PageHeader";
import { EmptyState, ErrorState, FormError, Skeleton, SkeletonRows } from "@/ui/States";
import { useToast } from "@/ui/Toast";

export function VolunteerDashboard() {
  usePageTitle("Volunteer home");
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["volunteer", "dashboard", user?.volunteer_status], queryFn: volunteerApi.dashboard });
  const approved = user?.volunteer_status === "approved";

  return (
    <>
      <PageHeader folio="§ Volunteer" title={<>Hello, <span className="emph">{user?.full_name.split(" ")[0]}</span></>}
        description="Your upcoming tasks and the events that still need volunteers."
        actions={<ButtonLink to="/events" iconRight={<ArrowRight className="size-4" />}>Browse events</ButtonLink>} />
      {q.isLoading && <SkeletonRows rows={3} className="h-28" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="space-y-14">
          <div className="grid gap-8 border-b border-line pb-10 sm:grid-cols-3">
            <div><p className="folio">Account status</p><div className="mt-3"><StatusPill status={q.data.volunteer.status} className="!text-base !px-3.5 !py-1" /></div></div>
            <Stat label="Events attended" value={q.data.events_attended} tone="berry" />
            <Stat label="Upcoming tasks" value={q.data.upcoming_assignments.length} />
          </div>

          <section>
            <SectionHead title="Your upcoming tasks" action={<Link to="/volunteer/tasks" className="text-sm font-semibold text-berry-700 hover:underline">View all</Link>} />
            {q.data.upcoming_assignments.length === 0 ? (
              <EmptyState icon={<CalendarX2 className="size-5" />} title="No upcoming tasks"
                action={approved ? <ButtonLink to="/events">Find an event</ButtonLink> : undefined}>
                {approved ? "Sign up for an event and an admin will assign your task." : "Once an admin approves your account you can sign up for events."}
              </EmptyState>
            ) : <div className="border-b border-line-strong">{q.data.upcoming_assignments.map((r) => <RegistrationRow key={r.registration_id} reg={r} />)}</div>}
          </section>

          <section>
            <SectionHead title="Open for sign-up" action={<Link to="/events" className="text-sm font-semibold text-berry-700 hover:underline">All events</Link>} />
            {q.data.open_events.length === 0
              ? <p className="text-ink-2">No events are open right now.</p>
              : <div className="border-b border-line-strong">{q.data.open_events.map((e) => <EventRow key={e.event_id} event={e} />)}</div>}
          </section>
        </div>
      )}
    </>
  );
}

export function VolunteerTasks() {
  usePageTitle("My tasks");
  const q = useQuery({ queryKey: ["volunteer", "tasks"], queryFn: volunteerApi.tasks });
  return (
    <>
      <PageHeader folio="§ Volunteer" title={<>My <span className="emph">tasks</span></>} description="Upcoming events you've signed up for, with the task an admin assigned to you." />
      {q.isLoading && <SkeletonRows rows={3} className="h-24" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={<CalendarX2 className="size-5" />} title="No upcoming tasks" action={<ButtonLink to="/events">Find an event</ButtonLink>}>You haven't signed up for any upcoming event.</EmptyState>}
      {q.data && q.data.length > 0 && <div className="border-b border-line-strong">{q.data.map((r) => <RegistrationRow key={r.registration_id} reg={r} />)}</div>}
    </>
  );
}

export function VolunteerHistory() {
  usePageTitle("Participation history");
  const q = useQuery({ queryKey: ["volunteer", "history"], queryFn: volunteerApi.history });
  return (
    <>
      <PageHeader folio="§ Volunteer" title={<>Participation <span className="emph">history</span></>} description="Every event you've signed up for, with attendance recorded by the team." />
      {q.isLoading && <SkeletonRows rows={4} className="h-24" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EmptyState icon={<History className="size-5" />} title="No history yet">Events you take part in will be listed here.</EmptyState>}
      {q.data && q.data.length > 0 && <div className="border-b border-line-strong">{q.data.map((r) => <RegistrationRow key={r.registration_id} reg={r} />)}</div>}
    </>
  );
}

interface ProfileForm { name: string; phone: string; availability: string; interests: string[] }

export function VolunteerProfile() {
  usePageTitle("Your profile");
  const toast = useToast();
  const qc = useQueryClient();
  const meta = useMeta();
  const { refreshUser } = useAuth();
  const q = useQuery({ queryKey: ["volunteer", "me"], queryFn: volunteerApi.me });
  const { register, handleSubmit, control, setError, formState: { errors, isDirty } } = useForm<ProfileForm>({
    values: q.data ? { name: q.data.name, phone: q.data.phone_number, availability: q.data.availability ?? "", interests: q.data.areas_of_interest } : undefined,
  });
  const [formError, setFormError] = useState<string>();

  const save = useMutation({
    mutationFn: (v: ProfileForm) => volunteerApi.update({ name: v.name.trim(), phone_number: v.phone.trim(), areas_of_interest: v.interests, availability: v.availability.trim() }),
    onSuccess: () => {
      toast.success("Profile saved.");
      qc.invalidateQueries({ queryKey: ["volunteer"] });
      refreshUser();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [f, m] of Object.entries(e.fieldErrors)) setError(f === "phone_number" ? "phone" : f === "areas_of_interest" ? "interests" : (f as "name"), { message: m });
      } else setFormError(e.message);
    },
  });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState asPage error={q.error} onRetry={() => q.refetch()} />;
  const v = q.data;

  return (
    <>
      <PageHeader folio="§ Volunteer" title={<>Your <span className="emph">profile</span></>} description={`Registered on ${fmtDate(v.created_at)}`} />
      <div className="grid gap-14 lg:grid-cols-2">
        <section>
          <SectionHead title="Details" />
          <form onSubmit={handleSubmit((vals) => { setFormError(undefined); save.mutate(vals); })} noValidate className="max-w-md space-y-5">
            <TextField label="Full name" error={errors.name?.message}
              {...register("name", { required: "Enter your name", validate: (x) => x.trim() !== "" || "Enter your name" })} />
            <TextField label="Phone" type="tel" error={errors.phone?.message}
              {...register("phone", { required: "Enter your phone number", validate: (x) => /^\+?\d{7,15}$/.test(x.replace(/[\s\-()]/g, "")) || "Enter 7 to 15 digits, with an optional + at the start" })} />
            <TextField label="Email" value={v.email} readOnly disabled hint="Your email is your sign-in ID and can't be changed here." />
            <Controller name="interests" control={control} defaultValue={[]}
              rules={{ validate: (x) => x.length > 0 || "Pick at least one area of interest" }}
              render={({ field }) => <InterestPicker value={field.value} onChange={field.onChange} suggestions={meta.data?.suggested_volunteer_interests ?? []} error={errors.interests?.message as string | undefined} />} />
            <TextAreaField label="Availability" optional rows={3} error={errors.availability?.message}
              {...register("availability", { maxLength: { value: 500, message: "Keep it under 500 characters" } })} />
            <FormError>{formError}</FormError>
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>Save changes</Button>
          </form>
        </section>
        <section>
          <SectionHead title="Change password" />
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
