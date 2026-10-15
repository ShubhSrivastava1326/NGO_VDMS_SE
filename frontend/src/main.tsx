import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ApiError } from "@/api/client";
import { AuthProvider } from "@/auth/AuthContext";
import { ErrorBoundary } from "@/layouts/ErrorBoundary";
import { ToastProvider } from "@/ui/Toast";
import App from "./App";
import "./styles/index.css";
import "./styles/public.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // retry only transient problems (network / 5xx); never retry 4xx answers
      retry: (count, error) => (error instanceof ApiError ? (error.status === 0 || error.status >= 500) && count < 2 : count < 1),
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* reducedMotion="user": transform/layout animations switch off for people who prefer less motion */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
