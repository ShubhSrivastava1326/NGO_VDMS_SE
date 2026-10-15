import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/lib/format";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "onDark";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-berry-700 text-white hover:bg-berry-800 active:bg-berry-900 disabled:bg-berry-300",
  secondary: "border border-berry-700 text-berry-700 hover:bg-blush-100 active:bg-blush-200 disabled:border-line-strong disabled:text-ink-3 disabled:hover:bg-transparent",
  soft: "bg-blush-100 text-berry-800 hover:bg-blush-200 active:bg-blush-300 disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-blush-100 active:bg-blush-200 disabled:text-ink-3 disabled:hover:bg-transparent",
  danger: "bg-danger-600 text-white hover:bg-[#8f1d17] disabled:bg-[#d98b86]",
  onDark: "bg-blush-100 text-berry-900 hover:bg-white disabled:opacity-60",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-[3.25rem] px-7 text-base",
};

export const buttonClass = (variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) =>
  cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap",
    "transition-[background-color,color,transform,border-color] duration-150 active:translate-y-px",
    variants[variant], sizes[size], extra,
  );

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** shows a spinner and blocks repeat clicks (no duplicate submissions) */
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, disabled, icon, iconRight, className, children, type = "button", ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}
export function ButtonLink({ variant = "primary", size = "md", icon, iconRight, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "inline-grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-blush-100 active:bg-blush-200 disabled:text-ink-3",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
