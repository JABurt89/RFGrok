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
  const [loggedTimestamps, setLoggedTimestamps] = useState<string[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [extraSetReps, setExtraSetReps] = useState<number | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);

  // Fetch workout suggestion
  const { data: suggestions, isLoading, error: queryError } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());

      try {
        const response = await apiRequest("GET", url.toString());
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
          throw new Error(errorData.error || "Failed to fetch workout suggestion");
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching workout suggestion:", error);
        throw error;
      }
    },
    enabled: Boolean(exerciseId) && Boolean(user),
  });

  // Create workout log mutation
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!selectedSuggestion?.parameters) throw new Error("No progression parameters selected");

      try {
        const response = await apiRequest("POST", "/api/workout-logs", {
          userId: user.id,
          date: new Date().toISOString(), // Send as ISO string
          sets: [{
            exerciseId,
            sets: [], // Initial empty sets array
            parameters: selectedSuggestion.parameters,
          }],
          isComplete: false
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
          throw new Error(errorData.error || "Failed to create workout log");
        }

        return response.json();
      } catch (error) {
        console.error("Error creating workout log:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setWorkoutLogId(data.id);
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
      if (!workoutLogId) throw new Error("No active workout log");
      if (!user) throw new Error("Not authenticated");
      if (!selectedSuggestion?.parameters) throw new Error("No progression parameters selected");

      const setsWithTimestamps = loggedReps.map((reps, index) => ({
        reps,
        weight: loggedWeights[index],
        timestamp: loggedTimestamps[index] || new Date().toISOString()
      }));

      try {
        const response = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
          sets: [{
            exerciseId,
            sets: setsWithTimestamps,
            extraSetReps,
            oneRm: selectedSuggestion?.calculated1RM,
            parameters: selectedSuggestion.parameters,
          }],
          isComplete: true
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
          throw new Error(errorData.error || "Failed to complete workout");
        }

        return response.json();
      } catch (error) {
        console.error("Error completing workout:", error);
        throw error;
      }
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

  // Handle starting a workout
  const handleStartWorkout = async (suggestion: any) => {
    try {
      setSelectedSuggestion(suggestion);
      await createLogMutation.mutateAsync();
      setIsWorkoutActive(true);
    } catch (error) {
      console.error("Error starting workout:", error);
      // Error is handled by mutation's onError callback
    }
  };

  // Handle logging a set
  const handleLogSet = (reps: number, weight: number) => {
    const timestamp = new Date().toISOString();
    setLoggedReps(prev => [...prev, reps]);
    setLoggedWeights(prev => [...prev, weight]);
    setLoggedTimestamps(prev => [...prev, timestamp]);
    setCurrentSet(prev => prev + 1);
    setRestTimer(selectedSuggestion?.parameters?.restBetweenSets ?? 90);
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

  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Please log in to view workout suggestions.
        </AlertDescription>
      </Alert>
    );
  }

  if (queryError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {queryError instanceof Error ? queryError.message : 'Error loading workout suggestion'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!isWorkoutActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workout Setup</CardTitle>
          <CardDescription>
            {isLoading ? "Loading suggestions..." : "Choose your workout target"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading suggestions...</span>
            </div>
          ) : Array.isArray(suggestions) ? (
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full text-left h-auto normal-case"
                  onClick={() => handleStartWorkout(suggestion)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      Option {idx + 1}: {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight}kg
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Estimated 1RM: {suggestion.calculated1RM.toFixed(2)}kg
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          ) : suggestions ? (
            <Button
              variant="outline"
              className="w-full text-left h-auto normal-case"
              onClick={() => handleStartWorkout(suggestions)}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">
                  {suggestions.sets} sets × {suggestions.reps} reps @ {suggestions.weight}kg
                </span>
                {suggestions.calculated1RM && (
                  <span className="text-sm text-muted-foreground">
                    Estimated 1RM: {suggestions.calculated1RM.toFixed(2)}kg
                  </span>
                )}
              </div>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

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
          <CardTitle>Set {currentSet + 1} of {selectedSuggestion?.sets}</CardTitle>
          <CardDescription>
            Target: {selectedSuggestion?.weight}kg × {selectedSuggestion?.reps} reps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Weight (kg)"
              defaultValue={selectedSuggestion?.weight}
            />
            <Input
              type="number"
              placeholder="Reps"
              onChange={(e) => {
                const weight = selectedSuggestion?.weight ?? 0;
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
          {currentSet >= (selectedSuggestion?.sets || 0) && (
            <div className="space-x-2">
              {Array.isArray(suggestions) && (
                <Input
                  type="number"
                  placeholder="Extra set reps (optional)"
                  className="w-40"
                  onChange={(e) => setExtraSetReps(parseInt(e.target.value))}
                />
              )}
              <Button
                onClick={() => completeMutation.mutate()}
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
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}