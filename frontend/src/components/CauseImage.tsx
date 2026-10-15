import { cn } from "@/lib/format";

export function causeImage(category: string) {
  const key = category.toLowerCase();
  if (/educat|school|child/.test(key)) return "/images/education.jpg";
  if (/health|medical/.test(key)) return "/images/healthcare.jpg";
  if (/environment|nature|green|animal/.test(key)) return "/images/environment.jpg";
  if (/food|relief|nutrition/.test(key)) return "/images/food.jpg";
  return "/images/volunteer.jpg";
}

/** Category photography is illustrative, not a photograph of a specific campaign. */
export function CauseImage({ category, className }: { category: string; className?: string }) {
  return <img src={causeImage(category)} alt="" loading="lazy" decoding="async" width={1000} height={667}
    className={cn("h-full w-full object-cover", className)} />;
}
