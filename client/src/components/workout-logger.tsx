import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Edit2, Timer } from "lucide-react";
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
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [extraSetReps, setExtraSetReps] = useState<number | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);
  const [showFailureOptions, setShowFailureOptions] = useState(false);

  // Fetch workout suggestion
  const { data: suggestions, isLoading, error: queryError } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || "Failed to fetch workout suggestion");
      }
      return response.json();
    },
    enabled: Boolean(exerciseId) && Boolean(user),
  });

  // Create workout log mutation
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedSuggestion?.parameters) throw new Error("Invalid workout setup");
      const response = await apiRequest("POST", "/api/workout-logs", {
        userId: user.id,
        date: new Date().toISOString(),
        sets: [{
          exerciseId,
          sets: [],
          parameters: selectedSuggestion.parameters,
        }],
        isComplete: false
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || "Failed to create workout log");
      }
      return response.json();
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
      if (!workoutLogId || !user || !selectedSuggestion?.parameters) {
        throw new Error("Invalid workout state");
      }

      const response = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
        sets: [{
          exerciseId,
          sets: loggedSets,
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

  const handleStartWorkout = async (suggestion: any) => {
    try {
      setSelectedSuggestion(suggestion);
      await createLogMutation.mutateAsync();
      setIsWorkoutActive(true);
    } catch (error) {
      console.error("Error starting workout:", error);
    }
  };

  const handleSetComplete = () => {
    if (!selectedSuggestion) return;

    const weight = editWeight ?? selectedSuggestion.weight;
    const reps = editReps ?? selectedSuggestion.reps;

    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString()
    }]);

    setCurrentSet(prev => prev + 1);
    setRestTimer(selectedSuggestion.parameters.restBetweenSets);
    setIsEditing(false);
    setEditWeight(null);
    setEditReps(null);
  };

  const handleSetFailed = (completedReps: number) => {
    if (!selectedSuggestion) return;

    setLoggedSets(prev => [...prev, {
      weight: selectedSuggestion.weight,
      reps: completedReps,
      timestamp: new Date().toISOString()
    }]);

    setCurrentSet(prev => prev + 1);
    setRestTimer(selectedSuggestion.parameters.restBetweenSets);
    setShowFailureOptions(false);
  };

  const handleEditToggle = () => {
    if (!selectedSuggestion) return;

    if (!isEditing) {
      setEditWeight(selectedSuggestion.weight);
      setEditReps(selectedSuggestion.reps);
    }
    setIsEditing(!isEditing);
  };

  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev === null || prev <= 0) return null;
          return prev - 1;
        });
      }, 1000);

      // Play sound when timer reaches 0
      if (restTimer === 1) {
        new Audio('/chime.mp3').play().catch(console.error);
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  if (!user) {
    return (
      <Alert>
        <AlertDescription>Please log in to view workout suggestions.</AlertDescription>
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
      {/* Rest Timer */}
      {restTimer !== null && restTimer > 0 && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              <span>Rest Time: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Set Card */}
      <Card>
        <CardHeader>
          <CardTitle>Set {currentSet + 1} of {selectedSuggestion?.sets}</CardTitle>
          <CardDescription>
            Target: {selectedSuggestion?.weight}kg × {selectedSuggestion?.reps} reps
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Previous Sets Summary */}
          {loggedSets.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-medium">Previous Sets:</h3>
              <div className="grid gap-2">
                {loggedSets.map((set, idx) => (
                  <div key={idx} className="text-sm flex justify-between items-center p-2 bg-muted rounded-md">
                    <span>Set {idx + 1}: {set.reps} reps @ {set.weight}kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Set Input */}
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  type="number"
                  value={editWeight ?? ''}
                  onChange={(e) => setEditWeight(Number(e.target.value))}
                  placeholder="Weight (kg)"
                  className="w-full"
                />
              </div>
              <div>
                <Input
                  type="number"
                  value={editReps ?? ''}
                  onChange={(e) => setEditReps(Number(e.target.value))}
                  placeholder="Reps"
                  className="w-full"
                />
              </div>
            </div>
          ) : showFailureOptions ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">How many reps completed?</h3>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: selectedSuggestion?.reps - 1 }, (_, i) => i + 1).map((rep) => (
                  <Button
                    key={rep}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetFailed(rep)}
                    className="w-full"
                  >
                    {rep}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          {!showFailureOptions && !isEditing && (
            <>
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleSetComplete}
                disabled={restTimer !== null && restTimer > 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Set Complete
              </Button>
              <Button
                variant="destructive"
                className="flex-1 sm:flex-none"
                onClick={() => setShowFailureOptions(true)}
                disabled={restTimer !== null && restTimer > 0}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Set Failed
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={handleEditToggle}
                disabled={restTimer !== null && restTimer > 0}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Set
              </Button>
            </>
          )}

          {isEditing && (
            <>
              <Button onClick={handleSetComplete} className="flex-1">Save</Button>
              <Button variant="outline" onClick={handleEditToggle} className="flex-1">Cancel</Button>
            </>
          )}

          {showFailureOptions && (
            <Button
              variant="outline"
              onClick={() => setShowFailureOptions(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Extra Set for STS */}
      {currentSet >= (selectedSuggestion?.sets || 0) && selectedSuggestion?.parameters?.scheme === "STS" && (
        <Card>
          <CardHeader>
            <CardTitle>Extra Set to Failure</CardTitle>
            <CardDescription>Optional: Perform one more set to failure</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              placeholder="Number of reps"
              value={extraSetReps ?? ''}
              onChange={(e) => setExtraSetReps(Number(e.target.value))}
              className="w-full"
            />
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => completeMutation.mutate()}>
              Skip Extra Set
            </Button>
            <Button
              onClick={() => {
                if (extraSetReps !== null) {
                  completeMutation.mutate();
                } else {
                  toast({
                    title: "Error",
                    description: "Please enter the number of reps completed",
                    variant: "destructive",
                  });
                }
              }}
              disabled={extraSetReps === null || completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Log Extra Set"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Complete Workout Button */}
      {currentSet >= (selectedSuggestion?.sets || 0) && selectedSuggestion?.parameters?.scheme !== "STS" && (
        <Button
          className="w-full"
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Completing Workout...
            </>
          ) : (
            "Complete Workout"
          )}
        </Button>
      )}
    </div>
  );
}