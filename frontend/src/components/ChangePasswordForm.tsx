import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/services";
import { Button } from "@/ui/Button";
import { PasswordField, passwordRules } from "@/ui/PasswordField";
import { FormError } from "@/ui/States";
import { useToast } from "@/ui/Toast";

export function ChangePasswordForm() {
  const toast = useToast();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<{ current: string; next: string }>();
  const [formError, setFormError] = useState<string>();

  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try {
      await authApi.changePassword(v.current, v.next);
      toast.success("Password updated.");
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.code === "WRONG_PASSWORD") setError("current", { message: "That isn't your current password" });
      else if (e instanceof ApiError && e.fieldErrors.new_password) setError("next", { message: e.fieldErrors.new_password });
      else setFormError(e instanceof Error ? e.message : "Something went wrong.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-4">
      <PasswordField label="Current password" autoComplete="current-password" error={errors.current?.message} {...register("current", { required: "Enter your current password" })} />
      <PasswordField label="New password" autoComplete="new-password" hint="At least 8 characters, with a letter and a digit." error={errors.next?.message} {...register("next", passwordRules)} />
      <FormError>{formError}</FormError>
      <Button type="submit" variant="secondary" loading={isSubmitting}>Update password</Button>
    </form>
  );
}
