import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PauseCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface WorkoutLoggerProps {
  exerciseId: number;
  onComplete: () => void;
}

export default function WorkoutLogger({ exerciseId, onComplete }: WorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedReps, setLoggedReps] = useState<number[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [estimated1RM, setEstimated1RM] = useState<number | null>(null);
  const [currentWorkoutLogId, setCurrentWorkoutLogId] = useState<number | null>(null);

  // Complete workout mutation
  const completeMutation = useMutation({
    mutationFn: async (logId: number) => {
      const response = await apiRequest("PATCH", `/api/workout-logs/${logId}`, { isComplete: true });
      if (!response.ok) {
        throw new Error("Failed to complete workout");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({
        title: "Success",
        description: "Workout completed successfully",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle completing the workout
  const handleCompleteWorkout = async () => {
    if (currentWorkoutLogId) {
      await completeMutation.mutate(currentWorkoutLogId);
    }
  };

  // Fetch workout suggestion
  const { data: suggestion, isLoading, error } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId, estimated1RM],
    queryFn: async () => {
      console.log("Fetching suggestion for exercise:", exerciseId, "with estimated 1RM:", estimated1RM);
      const url = new URL(`/api/workout-suggestion`, window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());
      if (estimated1RM) {
        url.searchParams.append('estimated1RM', estimated1RM.toString());
      }
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch workout suggestion');
      }
      const data = await response.json();
      console.log("Received suggestion:", data);
      return data;
    },
    enabled: Boolean(exerciseId) && Boolean(user),
    retry: 1,
  });

  // Handle workout start
  const handleStartWorkout = () => {
    if (!suggestion) {
      toast({
        title: "Error",
        description: "No workout suggestion available",
        variant: "destructive"
      });
      return;
    }
    setIsWorkoutActive(true);
  };

  // Rest timer effect
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);

      // Play sound when rest timer ends
      if (restTimer === 1) {
        try {
          const audio = new Audio("/notification.mp3");
          audio.play().catch(console.error);
        } catch (error) {
          console.error("Error playing notification sound:", error);
        }
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  // Not authenticated state
  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Please log in to view workout suggestions.
        </AlertDescription>
      </Alert>
    );
  }

  // Error state
  if (error) {
    console.error("Workout suggestion error:", error);
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Error loading workout suggestion. Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  // Setup view
  if (!isWorkoutActive) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Workout Setup</CardTitle>
            <CardDescription>
              {isLoading ? "Loading suggestion..." : "Review and start your workout"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading suggestions...</span>
              </div>
            ) : suggestion ? (
              <div className="space-y-2">
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-lg font-medium">
                    {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight}kg
                  </p>
                  {suggestion.calculated1RM && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Estimated 1RM: {suggestion.calculated1RM}kg
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    No previous workout data found. Please estimate your one-rep maximum (1RM) for this exercise:
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    placeholder="Enter estimated 1RM (kg)"
                    onChange={(e) => setEstimated1RM(Number(e.target.value))}
                  />
                  <Button
                    onClick={() => {
                      if (estimated1RM && estimated1RM > 0) {
                        // Re-fetch suggestion with estimated 1RM
                        queryClient.invalidateQueries({ queryKey: ['/api/workout-suggestion', exerciseId, estimated1RM] });
                      }
                    }}
                    disabled={!estimated1RM || estimated1RM <= 0}
                  >
                    Get Suggestion
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleStartWorkout}
              disabled={!suggestion || isLoading}
            >
              {isLoading ? "Loading..." : "Start Workout"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Active workout view
  return (
    <div className="space-y-4">
      {restTimer !== null && restTimer > 0 && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Rest Time: {restTimer}s</span>
            <PauseCircle className="h-5 w-5 animate-pulse" />
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logging Set {currentSet + 1}</CardTitle>
          <CardDescription>
            Target: {suggestion?.weight}kg × {suggestion?.reps} reps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="number"
              placeholder="Enter reps completed"
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                  setLoggedReps(prev => [...prev, value]);
                  setCurrentSet(prev => prev + 1);
                  setRestTimer(90); // Start 90 second rest timer
                }
              }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {loggedReps.map((reps, index) => (
              <div key={index} className="mt-2">
                Set {index + 1}: {reps} reps @ {suggestion?.weight}kg
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onComplete}>
            End Workout
          </Button>
          {currentSet >= (suggestion?.sets || 0) && (
            <Button 
              onClick={handleCompleteWorkout}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                "Complete Workout"
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}