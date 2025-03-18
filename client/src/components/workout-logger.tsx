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
import { STSParameters, DoubleProgressionParameters, RPTTopSetParameters, RPTIndividualParameters } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { STSProgression, ExerciseSet } from "@shared/progression";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface WorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  onComplete: () => void;
  totalExercises?: number;
}

export default function WorkoutLogger({ exerciseId, workoutDayId, parameters, onComplete, totalExercises = 3 }: WorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string; isFailure?: boolean; exceededMax?: boolean }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [extraSetReps, setExtraSetReps] = useState<number | undefined>(undefined);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);
  const [showRepsInput, setShowRepsInput] = useState(false);

  const prepareWorkoutLog = (sets: Array<{ reps: number; weight: number; timestamp: string; isFailure?: boolean }>) => {
    if (!sets || sets.length === 0) {
      throw new Error("Please log at least one set before completing the workout.");
    }
    return sets.map(set => ({
      ...set,
      timestamp: set.timestamp || new Date().toISOString()
    }));
  };


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

  // Add exercise query
  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
  });

  // Create workout log mutation
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedSuggestion) throw new Error("Invalid workout setup");
      const response = await apiRequest("POST", "/api/workout-logs", {
        userId: user.id,
        date: new Date().toISOString(),
        sets: [{
          exerciseId,
          sets: [],
          parameters: parameters,
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

  const handleStartWorkout = async (suggestion: any) => {
    try {
      setSelectedSuggestion(suggestion);

      // Initialize sets for RPT Top-Set workout
      if (parameters.scheme === "RPT Top-Set") {
        const topSetWeight = suggestion.weight;
        const sets = [{
          weight: topSetWeight,
          reps: parameters.minReps,
          timestamp: new Date().toISOString()
        }];

        // Generate subsequent sets with drop percentages
        for (let i = 1; i < parameters.sets; i++) {
          const dropPercentage = parameters.dropPercentages[i] || 0;
          const backOffWeight = topSetWeight * (1 - dropPercentage / 100);
          sets.push({
            weight: Math.round(backOffWeight * 2) / 2, // Round to nearest 0.5
            reps: parameters.minReps,
            timestamp: new Date().toISOString()
          });
        }
        suggestion.sets = sets;
      }

      await createLogMutation.mutateAsync();
      setIsWorkoutActive(true);

      // For RPT workouts, immediately show rep selection
      if (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set") {
        setShowRepsInput(true);
      }
    } catch (error) {
      console.error("Error starting workout:", error);
    }
  };

  const handleSetComplete = () => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    // For RPT workouts, always show rep selection UI
    if (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set") {
      setShowRepsInput(true);
      return;
    }

    // For other schemes like STS, directly log the set
    const weight = editWeight ?? target.weight;
    const reps = editReps ?? target.reps;

    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString(),
      isFailure: false
    }]);

    if (currentSet + 1 >= selectedSuggestion.sets) {
      setCurrentSet(prev => prev + 1);
      // Don't call onComplete() here for STS - wait for extra set
      if (parameters.scheme !== "STS") {
        onComplete();
      }
    } else {
      setCurrentSet(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
    }

    setIsEditing(false);
    setEditWeight(null);
    setEditReps(null);
  };

  const handleRepSelection = (reps: number, exceededMax: boolean = false) => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    const weight = editWeight ?? target.weight;

    // Add the completed set to logged sets
    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString(),
      isFailure: false,
      exceededMax
    }]);

    // Check if we've completed all sets
    if (currentSet + 1 >= (parameters.scheme === "RPT Top-Set" ? parameters.sets : selectedSuggestion.sets)) {
      setCurrentSet(prev => prev + 1);
      setShowRepsInput(false);
      onComplete(); // Move to next exercise
    } else {
      setCurrentSet(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
      setShowRepsInput(false); // Hide dialog during rest
    }

    setIsEditing(false);
    setEditWeight(null);
    setEditReps(null);
  };

  const handleSetFailed = (completedReps: number) => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    setLoggedSets(prev => [...prev, {
      weight: target.weight,
      reps: completedReps,
      timestamp: new Date().toISOString(),
      isFailure: true
    }]);

    // Continue to next set after failure
    setCurrentSet(prev => prev + 1);
    setRestTimer(parameters.restBetweenSets);
    setShowRepsInput(false);

    // Automatically enable editing for the next set after a failure
    setIsEditing(true);
    setEditWeight(target.weight);
    setEditReps(target.reps);
  };

  const handleEditToggle = () => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    if (!isEditing) {
      setEditWeight(target.weight);
      setEditReps(target.reps);
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

  // Get exercise name and position
  const getExerciseName = () => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Exercise";
  };

  const getCurrentSetTarget = () => {
    if (!selectedSuggestion) return null;

    const exerciseName = getExerciseName();
    const exercisePosition = Math.min(workoutDayId, totalExercises);
    const position = `${exercisePosition} of ${totalExercises}`;

    if (parameters.scheme === "RPT Top-Set") {
      // For RPT Top-Set, calculate weight based on drop percentage
      const dropPercentage = parameters.dropPercentages[currentSet] || 0;
      const baseWeight = selectedSuggestion.weight;
      const weight = baseWeight * (1 - dropPercentage / 100);

      return {
        weight: Math.round(weight * 2) / 2, // Round to nearest 0.5
        reps: parameters.maxReps,
        minReps: parameters.minReps,
        maxReps: parameters.maxReps,
        name: exerciseName,
        position
      };
    } else if (parameters.scheme === "RPT Individual") {
      const setConfig = parameters.setConfigs[currentSet];
      if (!setConfig) return null;
      return {
        weight: selectedSuggestion.weight,
        minReps: setConfig.min,
        maxReps: setConfig.max,
        name: exerciseName,
        position
      };
    }

    return {
      weight: selectedSuggestion.weight,
      reps: selectedSuggestion.reps,
      name: exerciseName,
      position
    };
  };

  const isLastSet = currentSet >= selectedSuggestion?.sets;
  const hasFailedCurrentSet = loggedSets[currentSet - 1]?.isFailure;

  // Initialize RPT workout
  useEffect(() => {
    if (!isWorkoutActive && (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set")) {
      const defaultSuggestion = {
        sets: parameters.sets,
        reps: parameters.maxReps,
        weight: suggestions?.[0]?.weight || 20,
        calculated1RM: suggestions?.[0]?.calculated1RM,
        name: getExerciseName(),
      };
      handleStartWorkout(defaultSuggestion);
    }
  }, [isWorkoutActive, parameters.scheme, suggestions, exercises]);

  // Show rep selection dialog automatically for RPT workouts
  useEffect(() => {
    if (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set") {
      // Show dialog when workout starts
      if (isWorkoutActive && currentSet === 0 && !showRepsInput) {
        setShowRepsInput(true);
      }
      // Show dialog after rest timer ends
      if (restTimer === 0 && !isLastSet && !showRepsInput) {
        setShowRepsInput(true);
      }
    }
  }, [parameters.scheme, isWorkoutActive, currentSet, restTimer, isLastSet, showRepsInput]);


  useEffect(() => {
    if (selectedSuggestion && parameters.scheme === "RPT Top-Set") {
      console.log("Current set:", currentSet);
      console.log("Selected suggestion:", selectedSuggestion);
      console.log("Target:", getCurrentSetTarget());
      console.log("Logged sets:", loggedSets);
    }
  }, [currentSet, selectedSuggestion, parameters.scheme]);

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

  // Show loading state while RPT workout is being initialized
  if (!isWorkoutActive && (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set")) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Starting workout...</span>
      </div>
    );
  }

  // Show suggestion selection only for non-RPT workouts
  if (!isWorkoutActive && parameters.scheme !== "RPT Individual" && parameters.scheme !== "RPT Top-Set") {
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

  const handleSkipExtraSet = async () => {
    try {
      console.log("Starting skip extra set handler");

      // Check if we have any sets logged
      if (!loggedSets || loggedSets.length === 0) {
        toast({
          title: "Error",
          description: "Please log at least one set before completing the workout.",
          variant: "destructive"
        });
        return;
      }

      // First update the workout log
      const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
        sets: [{
          exerciseId,
          sets: loggedSets.map(set => ({
            reps: set.reps,
            weight: set.weight,
            timestamp: set.timestamp || new Date().toISOString()
          })),
          parameters,
          extraSetReps: 0  // Explicitly set to 0 when skipping
        }],
        isComplete: true
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.message || "Failed to update workout log");
      }

      // Update local state
      setExtraSetReps(0);

      // Only complete after successful update
      onComplete();
    } catch (error) {
      console.error("Error in skipping extra set:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to skip extra set",
        variant: "destructive"
      });
    }
  };

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

      {/* Rep Selection Dialog */}
      <Dialog open={showRepsInput} onOpenChange={setShowRepsInput}>
        <DialogContent>
          <VisuallyHidden>
            <DialogTitle>Rep Selection</DialogTitle>
          </VisuallyHidden>
          <div className="text-xl font-semibold">
            {getCurrentSetTarget()?.name}
          </div>
          <DialogDescription>
            Select the number of repetitions completed for this set.
          </DialogDescription>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({
                length: getCurrentSetTarget()?.maxReps! - getCurrentSetTarget()?.minReps! + 1
              }, (_, i) => getCurrentSetTarget()?.minReps! + i).map((rep) => (
                <Button
                  key={rep}
                  variant={rep === getCurrentSetTarget()?.maxReps ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleRepSelection(rep);
                    setShowRepsInput(false);
                  }}
                  className={rep === getCurrentSetTarget()?.maxReps ? "bg-primary text-primary-foreground" : ""}
                >
                  {rep}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleRepSelection(getCurrentSetTarget()?.maxReps! + 1, true);
                  setShowRepsInput(false);
                }}
                className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
              >
                Max Range Exceeded ({getCurrentSetTarget()?.maxReps! + 1}+ reps)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Only show the workout status card for non-RPT workouts */}
      {(parameters.scheme !== "RPT Individual" && parameters.scheme !== "RPT Top-Set") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Set {currentSet + 1} of {selectedSuggestion?.sets}</CardTitle>
            <CardDescription className="text-lg font-semibold mt-2">
              <span className="text-primary">
                Target: {getCurrentSetTarget()?.weight}kg × {getCurrentSetTarget()?.reps} reps
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Previous Sets Summary */}
            {loggedSets.length > 0 && (
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-medium">Previous Sets:</h3>
                <div className="grid gap-2">
                  {loggedSets.map((set, idx) => (
                    <div key={idx} className="text-sm flex justify-between items-center p-2 bg-muted rounded-md">
                      <span>
                        Set {idx + 1}: {set.reps} reps @ {set.weight}kg
                        {set.isFailure && <span className="text-destructive ml-2">(Failed)</span>}
                        {set.exceededMax && <span className="text-primary ml-2">(Exceeded Max)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-wrap gap-2">
            {/* Show regular set completion buttons for other workout types */}
            {!isLastSet && !showRepsInput && !isEditing && (
              <>
                <Button
                  className="flex-1 sm:flex-none"
                  onClick={handleSetComplete}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Set Complete
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 sm:flex-none"
                  onClick={() => setShowRepsInput(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Set Failed
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={handleEditToggle}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Set
                </Button>
              </>
            )}

            {/* Edit mode buttons */}
            {isEditing && (
              <>
                <Button onClick={handleSetComplete} className="flex-1">Save Changes</Button>
                <Button variant="outline" onClick={handleEditToggle} className="flex-1">Cancel</Button>
              </>
            )}

            {/* Next Exercise button */}
            {(isLastSet && !showRepsInput && !isEditing && parameters.scheme !== "STS") || (isLastSet && parameters.scheme === "STS" && extraSetReps !== undefined) ? (
              <Button
                className="w-full"
                onClick={() => onComplete()}
              >
                Next Exercise
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      )}

      {/* Extra Set for STS */}
      {isLastSet && parameters.scheme === "STS" && (
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
            <Button
              variant="outline"
              onClick={handleSkipExtraSet}
            >
              Skip Extra Set
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!loggedSets || loggedSets.length === 0) {
                    toast({
                      title: "Error",
                      description: "Please log at least one set before completing the workout.",
                      variant: "destructive"
                    });
                    return;
                  }
                  if (typeof extraSetReps === 'number') {
                    // First update the workout log
                    const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
                      sets: [{
                        exerciseId,
                        sets: loggedSets.map(set => ({
                          reps: set.reps,
                          weight: set.weight,
                          timestamp: set.timestamp || new Date().toISOString()
                        })),
                        parameters,
                        extraSetReps: extraSetReps  // Use the actual extra set reps value
                      }],
                      isComplete: true
                    });

                    if (!updateResponse.ok) {
                      const error = await updateResponse.json();
                      throw new Error(error.message || "Failed to update workout log");
                    }

                    console.log("Successfully logged extra set with reps:", extraSetReps);
                    onComplete();
                  } else {
                    toast({
                      title: "Error",
                      description: "Please enter the number of reps completed",
                      variant: "destructive"
                    });
                  }
                } catch (error) {
                  console.error("Error logging extra set:", error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to log extra set",
                    variant: "destructive"
                  });
                }
              }}
            >
              Log Extra Set
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}