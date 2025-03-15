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
  workoutDayId: number;
  onComplete: () => void;
}

export default function WorkoutLogger({ exerciseId, workoutDayId, onComplete }: WorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedReps, setLoggedReps] = useState<number[]>([]);
  const [loggedWeights, setLoggedWeights] = useState<number[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [estimated1RM, setEstimated1RM] = useState<number | null>(null);
  const [currentWorkoutLogId, setCurrentWorkoutLogId] = useState<number | null>(null);

  // Create workout log mutation
  const createLogMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/workout-logs", {
        userId: user?.id,
        workoutDayId,
        date: new Date().toISOString(),
        sets: [{
          exerciseId,
          sets: [],
          extraSetReps: undefined,
        }],
        isComplete: false
      });
      if (!response.ok) {
        throw new Error("Failed to create workout log");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentWorkoutLogId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Complete workout mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkoutLogId) throw new Error("No active workout log");

      const response = await apiRequest("PATCH", `/api/workout-logs/${currentWorkoutLogId}`, {
        sets: [{
          exerciseId,
          sets: loggedReps.map((reps, index) => ({
            reps,
            weight: loggedWeights[index],
            timestamp: new Date().toISOString()
          })),
        }],
        isComplete: true
      });

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
    await completeMutation.mutate();
  };

  // Fetch workout suggestion
  const { data: suggestion, isLoading, error } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId, estimated1RM],
    queryFn: async () => {
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());
      if (estimated1RM) {
        url.searchParams.append('estimated1RM', estimated1RM.toString());
      }
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch workout suggestion');
      }
      return response.json();
    },
    enabled: Boolean(exerciseId) && Boolean(user),
  });

  // Handle workout start
  const handleStartWorkout = async () => {
    if (!suggestion) {
      toast({
        title: "Error",
        description: "No workout suggestion available",
        variant: "destructive"
      });
      return;
    }
    await createLogMutation.mutate();
    setIsWorkoutActive(true);
  };

  // Handle logging a set
  const handleLogSet = (reps: number, weight: number) => {
    setLoggedReps(prev => [...prev, reps]);
    setLoggedWeights(prev => [...prev, weight]);
    setCurrentSet(prev => prev + 1);
    setRestTimer(90); // Start 90 second rest timer
  };

  // Rest timer effect
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);
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
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Error loading workout suggestion'}
        </AlertDescription>
      </Alert>
    );
  }

  // Setup view
  if (!isWorkoutActive) {
    return (
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
              <Input
                type="number"
                placeholder="Enter estimated 1RM (kg)"
                onChange={(e) => setEstimated1RM(Number(e.target.value))}
              />
              <Button
                onClick={() => {
                  if (estimated1RM && estimated1RM > 0) {
                    queryClient.invalidateQueries({ queryKey: ['/api/workout-suggestion', exerciseId, estimated1RM] });
                  }
                }}
                disabled={!estimated1RM || estimated1RM <= 0}
              >
                Get Suggestion
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleStartWorkout}
            disabled={!suggestion || isLoading || createLogMutation.isPending}
          >
            {createLogMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Workout"
            )}
          </Button>
        </CardFooter>
      </Card>
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
          <CardTitle>Set {currentSet + 1} of {suggestion?.sets}</CardTitle>
          <CardDescription>
            Target: {suggestion?.weight}kg × {suggestion?.reps} reps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Weight (kg)"
              defaultValue={suggestion?.weight}
            />
            <Input
              type="number"
              placeholder="Reps"
              onChange={(e) => {
                const weight = suggestion?.weight ?? 0;
                const reps = parseInt(e.target.value);
                if (!isNaN(reps) && reps > 0) {
                  handleLogSet(reps, weight);
                }
              }}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {loggedReps.map((reps, index) => (
              <div key={index} className="mt-2">
                Set {index + 1}: {reps} reps @ {loggedWeights[index]}kg
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onComplete}>
            Cancel
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