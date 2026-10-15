import { useEffect } from "react";
import { Clock3, PauseCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

/**
 * Approval status banner for the volunteer area. The status can change while the volunteer is away
 * (an admin approves or deactivates them), so it re-reads /auth/me when the area opens.
 */
export function VolunteerBanner() {
  const { user, refreshUser } = useAuth();
  useEffect(() => { refreshUser().catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const s = user?.volunteer_status;
  if (s !== "pending" && s !== "deactivated") return null;
  const pending = s === "pending";
  const Icon = pending ? Clock3 : PauseCircle;
  return (
    <div role="status" className={pending ? "border-b border-amber-700/25 bg-amber-50" : "border-b border-line-strong bg-blush-100"}>
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3.5 sm:px-8">
        <Icon className={pending ? "mt-0.5 size-5 shrink-0 text-amber-700" : "mt-0.5 size-5 shrink-0 text-ink-2"} aria-hidden="true" />
        <p className="text-[0.95rem] text-ink">
          {pending ? (
            <><strong className="font-semibold">Awaiting approval.</strong> An admin will review your registration. You can sign up for events as soon as you're approved.</>
          ) : (
            <><strong className="font-semibold">Your account is deactivated.</strong> You can't sign up for new events. Please contact the NGO team.</>
          )}
        </p>
      </div>
    </div>
  );
}
