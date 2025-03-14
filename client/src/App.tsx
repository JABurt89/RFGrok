import { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from "wouter";
import { ProtectedRoute } from "@/lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/lib/theme";

// Lazy load pages
const HomePage = lazy(() => import("@/pages/home-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const WorkoutsPage = lazy(() => import("@/pages/workouts-page"));
const ExercisesPage = lazy(() => import("@/pages/exercises-page"));
const WorkoutHistoryPage = lazy(() => import("@/pages/workout-history-page"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Suspense fallback={<LoadingFallback />}>
              <Switch>
                <Route path="/auth" component={AuthPage} />
                <ProtectedRoute path="/" component={HomePage} />
                <ProtectedRoute path="/workouts" component={WorkoutsPage} />
                <ProtectedRoute path="/exercises" component={ExercisesPage} />
                <ProtectedRoute path="/workout-history" component={WorkoutHistoryPage} />
                <Route component={NotFoundPage} />
              </Switch>
            </Suspense>
            <Toaster />
          </div>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;