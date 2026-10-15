import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/ui/Button";

/** Last-resort guard so a rendering bug shows a calm message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="container-page grid min-h-[70vh] place-items-center text-center">
        <div className="max-w-md">
          <p className="folio">Something broke</p>
          <h1 className="mt-2 text-4xl">We hit an unexpected problem.</h1>
          <p className="mt-3 text-ink-2">Your data is safe. Reload the page, and if it keeps happening please tell the NGO team.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      </div>
    );
  }
}
