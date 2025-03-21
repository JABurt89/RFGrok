import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">FitTrack Pro</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Welcome back, {user?.email}</h2>
          <p className="text-muted-foreground">Track your progress and achieve your fitness goals</p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/workouts">
            <Card className="hover:bg-accent cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Workouts
                </CardTitle>
                <CardDescription>Start or plan your workouts</CardDescription>
              </CardHeader>
              <CardContent>
                <p>View your workout plans and track your progress</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/exercises">
            <Card className="hover:bg-accent cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5" />
                  Exercises
                </CardTitle>
                <CardDescription>Manage your exercises</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Create and customize your exercise library</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="hover:bg-accent cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Settings
                </CardTitle>
                <CardDescription>Update your preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Customize your workout experience</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}