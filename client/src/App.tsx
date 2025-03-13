import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from "wouter";
import { ProtectedRoute } from "@/lib/protected-route";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import WorkoutsPage from "@/pages/workouts-page";
import ExercisesPage from "@/pages/exercises-page";
import WorkoutHistoryPage from "@/pages/workout-history-page";
import { AuthProvider } from "@/hooks/use-auth";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <ProtectedRoute path="/" component={HomePage} />
            <ProtectedRoute path="/workouts" component={WorkoutsPage} />
            <ProtectedRoute path="/exercises" component={ExercisesPage} />
            <ProtectedRoute path="/workout-history" component={WorkoutHistoryPage} />
          </Switch>
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;