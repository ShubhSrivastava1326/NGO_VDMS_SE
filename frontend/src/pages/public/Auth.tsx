import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "@/api/client";
import { homeFor, useAuth } from "@/auth/AuthContext";
import { AuthShell } from "@/components/AuthShell";
import { InterestPicker } from "@/components/InterestPicker";
import { useMeta, usePageTitle } from "@/lib/hooks";
import { Button } from "@/ui/Button";
import { TextAreaField, TextField } from "@/ui/Fields";
import { PasswordField, passwordRules } from "@/ui/PasswordField";
import { FormError } from "@/ui/States";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneOk = (v: string) => /^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, ""));

/** Put server field errors on the right inputs; return a message for anything left over. */
function applyServerErrors(e: unknown, setError: (name: never, o: { message: string }) => void, known: string[]): string | undefined {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  let mapped = false;
  for (const [field, message] of Object.entries(e.fieldErrors)) {
    if (known.includes(field)) { setError(field as never, { message }); mapped = true; }
  }
  return mapped ? undefined : e.message;
}

// ------------------------------------------------------------------------------------ login
export function Login() {
  usePageTitle("Sign in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>();
  const [formError, setFormError] = useState<string>();

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      const user = await login(v.email.trim(), v.password);
      navigate(from && from !== "/login" ? from : homeFor(user.role), { replace: true });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  });

  return (
    <AuthShell
      folio="§ Sign in"
      title={<>Welcome <span className="emph">back.</span></>}
      points={["Donors see their donation history and receipts", "Volunteers see approval status, events and tasks", "NGO staff manage campaigns, events and funds"]}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <h2 className="text-2xl lg:text-3xl">Sign in to your account</h2>
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message}
          {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "Enter a valid email address" } })} />
        <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message}
          {...register("password", { required: "Enter your password" })} />
        <FormError>{formError}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
        <p className="text-center text-[0.95rem] text-ink-2">
          New here? <Link to="/register/donor" className="font-semibold text-berry-700 underline underline-offset-4">Create a donor account</Link> or{" "}
          <Link to="/register/volunteer" className="font-semibold text-berry-700 underline underline-offset-4">become a volunteer</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------- volunteer sign-up
interface VolForm { name: string; email: string; phone: string; password: string; availability: string; interests: string[] }

export function RegisterVolunteer() {
  usePageTitle("Become a volunteer");
  const { registerVolunteer } = useAuth();
  const navigate = useNavigate();
  const meta = useMeta();
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<VolForm>({ defaultValues: { interests: [] } });
  const [formError, setFormError] = useState<string>();

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      await registerVolunteer({
        name: v.name.trim(), email: v.email.trim(), password: v.password, phone_number: v.phone.trim(),
        areas_of_interest: v.interests, availability: v.availability.trim() || undefined,
      });
      navigate("/volunteer", { replace: true }); // lands on the "awaiting approval" state
    } catch (e) {
      setFormError(applyServerErrors(e, setError as never, ["name", "email", "password", "phone_number", "areas_of_interest", "availability"]));
    }
  });

  return (
    <AuthShell
      folio="§ Volunteer"
      title={<>Give a few hours, <span className="emph">make them count.</span></>}
      points={["Registration is free and takes a minute", "An admin approves your account before you can sign up", "Pick events with open slots and see your assigned task"]}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <h2 className="text-2xl lg:text-3xl">Register as a volunteer</h2>
        <TextField label="Full name" autoComplete="name" error={errors.name?.message}
          {...register("name", { required: "Enter your name", validate: (v) => v.trim() !== "" || "Enter your name" })} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message}
            {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "Enter a valid email address" } })} />
          <TextField label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message}
            {...register("phone", { required: "Enter your phone number", validate: (v) => phoneOk(v) || "Enter 7 to 15 digits, with an optional + at the start" })} />
        </div>
        <PasswordField label="Password" autoComplete="new-password" hint="At least 8 characters, with a letter and a digit." error={errors.password?.message}
          {...register("password", passwordRules)} />
        <Controller
          name="interests"
          control={control}
          rules={{ validate: (v) => v.length > 0 || "Pick at least one area of interest" }}
          render={({ field }) => (
            <InterestPicker value={field.value} onChange={field.onChange} suggestions={meta.data?.suggested_volunteer_interests ?? []} error={errors.interests?.message as string | undefined} />
          )}
        />
        <TextAreaField label="Availability" optional rows={3} placeholder="e.g. Weekends and weekday evenings" error={errors.availability?.message}
          {...register("availability", { maxLength: { value: 500, message: "Keep it under 500 characters" } })} />
        <FormError>{formError}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create volunteer account</Button>
        <p className="text-center text-[0.95rem] text-ink-2">Already registered? <Link to="/login" className="font-semibold text-berry-700 underline underline-offset-4">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}

// ------------------------------------------------------------------------------- donor sign-up
export function RegisterDonor() {
  usePageTitle("Create a donor account");
  const { registerDonor } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ name: string; email: string; phone: string; password: string }>();
  const [formError, setFormError] = useState<string>();

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      await registerDonor({ name: v.name.trim(), email: v.email.trim(), password: v.password, phone_number: v.phone.trim() || undefined });
      navigate("/donor", { replace: true });
    } catch (e) {
      setFormError(applyServerErrors(e, setError as never, ["name", "email", "password", "phone_number"]));
    }
  });

  return (
    <AuthShell
      folio="§ Donor account"
      title={<>Keep your giving <span className="emph">in one place.</span></>}
      points={["Donate without re-typing your details", "See every donation and download each receipt", "An account is optional: guests can always donate"]}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <h2 className="text-2xl lg:text-3xl">Create a donor account</h2>
        <TextField label="Full name" autoComplete="name" error={errors.name?.message}
          {...register("name", { required: "Enter your name", validate: (v) => v.trim() !== "" || "Enter your name" })} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message}
          {...register("email", { required: "Enter your email", pattern: { value: EMAIL, message: "Enter a valid email address" } })} />
        <TextField label="Phone" type="tel" autoComplete="tel" optional error={errors.phone?.message}
          {...register("phone", { validate: (v) => !v.trim() || phoneOk(v) || "Enter 7 to 15 digits, with an optional + at the start" })} />
        <PasswordField label="Password" autoComplete="new-password" hint="At least 8 characters, with a letter and a digit." error={errors.password?.message}
          {...register("password", passwordRules)} />
        <FormError>{formError}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
        <p className="text-center text-[0.95rem] text-ink-2">Already have an account? <Link to="/login" className="font-semibold text-berry-700 underline underline-offset-4">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
