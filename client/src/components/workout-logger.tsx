import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { STSProgression } from "@shared/progression";

interface WorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  onComplete: () => void;
  totalExercises?: number;
}

export default function WorkoutLogger({ exerciseId, workoutDayId, parameters, onComplete, totalExercises = 3 }: WorkoutLoggerProps) {
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
  const [showRepsInput, setShowRepsInput] = useState(parameters.scheme === "RPT Top-Set" || parameters.scheme === "RPT Individual");
  const [currentSetIndex, setCurrentSetIndex] = useState(0);

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

  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
  });

  const handleStartWorkout = async (suggestion: any) => {
    try {
      setSelectedSuggestion(suggestion);
      const response = await apiRequest("POST", "/api/workout-logs", {
        userId: user!.id,
        date: new Date().toISOString(),
        sets: [{
          exerciseId,
          sets: [],
          parameters,
        }],
        isComplete: false
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create workout log");
      }

      const data = await response.json();
      setWorkoutLogId(data.id);
      setIsWorkoutActive(true);
    } catch (error) {
      console.error("Error starting workout:", error);
    }
  };

  const handleSetComplete = () => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    if (parameters.scheme === "RPT Top-Set" || parameters.scheme === "RPT Individual") {
      setShowRepsInput(true);
      return;
    }

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
      setCurrentSetIndex(0);
      if (parameters.scheme !== "STS") {
        onComplete();
      }
    } else {
      setCurrentSet(prev => prev + 1);
      if (parameters.scheme === "RPT Top-Set" || parameters.scheme === "RPT Individual") {
        setCurrentSetIndex(prev => prev + 1);
      }
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

    const weight = target.weight;

    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString(),
      isFailure: false,
      exceededMax
    }]);

    if (currentSet + 1 >= selectedSuggestion.sets) {
      setCurrentSet(prev => prev + 1);
      setCurrentSetIndex(0);
      setShowRepsInput(false);
      onComplete();
    } else {
      setCurrentSet(prev => prev + 1);
      setCurrentSetIndex(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
      setShowRepsInput(false);
    }
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

    setCurrentSet(prev => prev + 1);
    setRestTimer(parameters.restBetweenSets);
    setShowRepsInput(false);

    setIsEditing(true);
    setEditWeight(target.weight);
    setEditReps(target.reps);
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

      if (restTimer === 1) {
        new Audio('/chime.mp3').play().catch(console.error);
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    if (restTimer === 0 && parameters.scheme === "RPT Top-Set") {
      setRestTimer(null);
      setShowRepsInput(true);
    }
  }, [restTimer, parameters.scheme]);

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
      const dropPercentage = parameters.dropPercentages[currentSetIndex] || 0;
      const baseWeight = selectedSuggestion.weight;
      const weight = baseWeight * (1 - dropPercentage / 100);

      return {
        weight: Math.round(weight * 2) / 2,
        reps: parameters.maxReps,
        minReps: parameters.minReps,
        maxReps: parameters.maxReps,
        name: exerciseName,
        position,
        isDropSet: currentSetIndex > 0
      };
    } else if (parameters.scheme === "RPT Individual") {
      const setConfig = parameters.setConfigs[currentSetIndex];
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

  if (!isWorkoutActive && (parameters.scheme === "RPT Individual" || parameters.scheme === "RPT Top-Set")) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Starting workout...</span>
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
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

      {(parameters.scheme === "RPT Top-Set" || parameters.scheme === "RPT Individual") && (
        <Dialog open={showRepsInput} onOpenChange={setShowRepsInput}>
          <DialogContent>
            <DialogTitle className="text-xl font-semibold">
              {getCurrentSetTarget()?.name}
              {getCurrentSetTarget()?.isDropSet && (
                <span className="text-muted-foreground text-sm ml-2">
                  (Drop Set: {parameters.dropPercentages[currentSetIndex]}% less)
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Target Weight: {getCurrentSetTarget()?.weight}kg
              <br />
              Select the number of repetitions completed for this set.
            </DialogDescription>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {Array.from(
                  { length: (getCurrentSetTarget()?.maxReps || 0) - (getCurrentSetTarget()?.minReps || 0) + 1 },
                  (_, i) => (getCurrentSetTarget()?.minReps || 0) + i
                ).map((rep) => (
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
                    const target = getCurrentSetTarget();
                    if (target) {
                      handleRepSelection(target.maxReps + 1, true);
                      setShowRepsInput(false);
                    }
                  }}
                  className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
                >
                  Max Range Exceeded ({getCurrentSetTarget()?.maxReps! + 1}+ reps)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Set
                </Button>
              </>
            )}

            {isEditing && (
              <>
                <Button onClick={handleSetComplete} className="flex-1">Save Changes</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
              </>
            )}

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

                  const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
                    sets: [{
                      exerciseId,
                      sets: loggedSets.map(set => ({
                        reps: set.reps,
                        weight: set.weight,
                        timestamp: set.timestamp || new Date().toISOString()
                      })),
                      parameters,
                      extraSetReps: 0
                    }],
                    isComplete: true
                  });

                  if (!updateResponse.ok) {
                    const error = await updateResponse.json();
                    throw new Error(error.message || "Failed to update workout log");
                  }

                  setExtraSetReps(0);
                  onComplete();
                } catch (error) {
                  console.error("Error in skipping extra set:", error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to skip extra set",
                    variant: "destructive"
                  });
                }
              }}
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
                    const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
                      sets: [{
                        exerciseId,
                        sets: loggedSets.map(set => ({
                          reps: set.reps,
                          weight: set.weight,
                          timestamp: set.timestamp || new Date().toISOString()
                        })),
                        parameters,
                        extraSetReps: extraSetReps
                      }],
                      isComplete: true
                    });

                    if (!updateResponse.ok) {
                      const error = await updateResponse.json();
                      throw new Error(error.message || "Failed to update workout log");
                    }

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