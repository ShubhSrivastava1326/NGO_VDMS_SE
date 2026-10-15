import { ButtonLink } from "@/ui/Button";
import { usePageTitle } from "@/lib/hooks";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="container-page grid min-h-[60vh] place-items-center pb-20 pt-10 text-center">
      <div>
        <p className="folio">Error 404</p>
        <h1 className="display mt-3 text-[clamp(3rem,9vw,6rem)]">Thread <span className="emph">lost.</span></h1>
        <p className="mx-auto mt-4 max-w-md text-ink-2">We couldn't find that page. It may have moved, or the link may be mistyped.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/">Go home</ButtonLink>
          <ButtonLink to="/campaigns" variant="secondary">Browse causes</ButtonLink>
        </div>
      </div>
    </div>
  );
}
