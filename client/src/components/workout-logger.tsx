import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise } from "@shared/schema";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { STSProgression, type ProgressionSuggestion } from "@shared/progression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Loader2, PlayCircle, PauseCircle, CheckCircle, XCircle, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Types
type WorkoutView = "setup" | "active";

interface WorkoutState {
  workoutDayId: number;
  date: Date;
  exercises: Array<{
    exerciseId: number;
    scheme: string;
    sets: Array<{
      weight: number;
      reps: number;
      actualReps?: number;
      isCompleted?: boolean;
      timestamp: Date;
    }>;
    extraSetReps?: number;
    oneRm?: number;
    plannedSets?: number;
  }>;
}

interface ExerciseSet {
  weight: number;
  reps: number;
  actualReps?: number;
  isCompleted?: boolean;
  timestamp: Date;
}

// Manual input form schema
const manualInputSchema = z.object({
  sets: z.number().min(1, "Sets must be at least 1"),
  reps: z.number().min(1, "Reps must be at least 1").max(100, "Reps cannot exceed 100"),
  weight: z.number().min(1, "Weight must be at least 1").max(1000, "Weight cannot exceed 1000"),
});

type ManualInputForm = z.infer<typeof manualInputSchema>;

type WorkoutLoggerProps = {
  workoutDay: WorkoutDay;
  onComplete: () => void;
};

const WorkoutLogger = ({ workoutDay, onComplete }: WorkoutLoggerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<WorkoutView>("setup");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>(() => ({
    workoutDayId: workoutDay.id,
    date: new Date(),
    exercises: workoutDay.exercises.map(exercise => ({
      exerciseId: exercise.exerciseId,
      scheme: exercise.parameters.scheme,
      sets: [],
      extraSetReps: undefined,
      oneRm: undefined,
      plannedSets: undefined
    }))
  }));

  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [editable1RM, setEditable1RM] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);
  const [showExtraSetPrompt, setShowExtraSetPrompt] = useState(false);
  const [conflict, setConflict] = useState<WorkoutLog | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ProgressionSuggestion | null>(null);


  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const { data: workoutLogs = [] } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs"],
  });

  const currentExerciseData = useMemo(() =>
    workoutDay.exercises[currentExerciseIndex],
    [workoutDay.exercises, currentExerciseIndex]
  );

  const currentExercise = useMemo(() =>
    exercises?.find(e => e.id === currentExerciseData?.exerciseId),
    [exercises, currentExerciseData]
  );

  const currentState = useMemo(() =>
    workoutState.exercises[currentExerciseIndex] || { sets: [] },
    [workoutState.exercises, currentExerciseIndex]
  );

  const remainingSets = useMemo(() => {
    return Array.isArray(currentState.sets) ?
      currentState.sets.filter(set => !set.isCompleted) :
      [];
  }, [currentState.sets]);

  const completedSetsCount = useMemo(() =>
    Array.isArray(currentState.sets) ?
      currentState.sets.filter(set => set.isCompleted).length : 0,
    [currentState.sets]
  );

  const progressionScheme = useMemo(() => {
    if (!currentExerciseData) return new STSProgression();

    const params = currentExerciseData.parameters;
    switch (params.scheme) {
      case "STS":
        return new STSProgression(
          params.minSets,
          params.maxSets,
          params.minReps,
          params.maxReps
        );
      default:
        return new STSProgression();
    }
  }, [currentExerciseData]);

  const progressionSuggestions = useMemo(() => {
    if (!currentExercise || !currentExerciseData) return [];

    switch (currentExerciseData.parameters.scheme) {
      case "STS":
        return (progressionScheme as STSProgression).getNextSuggestion(editable1RM, currentExercise.increment);
      default:
        return [];
    }
  }, [currentExercise, currentExerciseData, progressionScheme, editable1RM, currentState.sets]);


  const calculate1RM = useCallback((weight: number, reps: number, sets: number, extraSetReps?: number): number => {
    const exerciseSets = Array(sets).fill({ weight, reps });
    return (progressionScheme as STSProgression).calculate1RM(exerciseSets, extraSetReps);
  }, [progressionScheme]);

  const saveWorkoutMutation = useMutation({
    mutationFn: async (workoutLog: WorkoutLog) => {
      const response = await apiRequest("POST", "/api/workout-logs", workoutLog);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save workout: ${JSON.stringify(errorData)}`);
      }
      return response.json();
    },
    onMutate: async (newWorkoutLog) => {
      await queryClient.cancelQueries({ queryKey: ["/api/workout-logs"] });
      const previousWorkoutLogs = queryClient.getQueryData<WorkoutLog[]>(["/api/workout-logs"]);
      queryClient.setQueryData<WorkoutLog[]>(["/api/workout-logs"], old => {
        const optimisticLog = {
          ...newWorkoutLog,
          id: Date.now(),
          date: new Date().toISOString()
        };
        return [...(old || []), optimisticLog];
      });
      return { previousWorkoutLogs };
    },
    onError: (err, newWorkoutLog, context) => {
      queryClient.setQueryData(["/api/workout-logs"], context?.previousWorkoutLogs);
      toast({
        title: "Error saving workout",
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Workout saved successfully!",
      });
      onComplete();
    }
  });

  const saveAndExitWorkout = useCallback(async () => {
    try {
      setIsLoading(true);
      const workoutLog: WorkoutLog = {
        workoutDayId: Number(workoutDay.id),
        date: new Date().toISOString(),
        sets: workoutState.exercises.map(exercise => ({
          exerciseId: Number(exercise.exerciseId),
          sets: (exercise.sets || []).map(set => ({
            reps: Number(set.actualReps || set.reps),
            weight: Number(set.weight),
            timestamp: new Date(set.timestamp).toISOString()
          })),
          extraSetReps: exercise.extraSetReps ? Number(exercise.extraSetReps) : undefined,
          oneRm: exercise.oneRm ? Number(exercise.oneRm) : undefined
        })),
        isComplete: true
      };

      await saveWorkoutMutation.mutateAsync(workoutLog);
    } catch (error) {
      console.error('Error saving workout:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workoutDay.id, workoutState, saveWorkoutMutation]);

  const handleSetComplete = useCallback((setIndex: number, completed: boolean, actualReps?: number) => {
    if (!currentExerciseData) return;

    setWorkoutState(prev => {
      const updatedExercises = prev.exercises.map(exercise => {
        if (exercise.exerciseId !== currentExerciseData.exerciseId) return exercise;

        const sets = [...(exercise.sets || [])];
        sets[setIndex] = {
          ...sets[setIndex],
          isCompleted: completed,
          actualReps: actualReps ? Number(actualReps) : Number(sets[setIndex].reps),
          timestamp: new Date()
        };

        let oneRm = undefined;
        if (currentExerciseData.parameters.scheme === "STS" && progressionScheme.calculate1RM) {
          oneRm = progressionScheme.calculate1RM(
            sets.filter(s => s.isCompleted).map(s => ({
              weight: Number(s.weight),
              reps: Number(s.actualReps || s.reps)
            })),
            exercise.extraSetReps
          );
        }

        const allSetsCompleted = sets.every(set => set.isCompleted);
        if (allSetsCompleted && currentExerciseData.parameters.scheme === "STS") {
          setShowExtraSetPrompt(true);
        }

        return {
          ...exercise,
          sets,
          oneRm
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });

    const { setRest } = getRestTimes();
    setRestTimer(setRest);
  }, [currentExerciseData, progressionScheme]);

  const handleExtraSetComplete = useCallback((reps: number | null) => {
    if (!currentExerciseData || reps === null) {
      setShowExtraSetPrompt(false);
      return;
    }

    setWorkoutState(prev => {
      const updatedExercises = prev.exercises.map(exercise => {
        if (exercise.exerciseId !== currentExerciseData.exerciseId) return exercise;

        const lastSet = exercise.sets[exercise.sets.length - 1];

        return {
          ...exercise,
          extraSetReps: reps,
          oneRm: progressionScheme.calculate1RM(
            [
              { weight: Number(lastSet.weight), reps: Number(lastSet.reps) }
            ], reps
          )
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });

    setShowExtraSetPrompt(false);
  }, [currentExerciseData, progressionScheme]);

  const handleUseWeights = (suggestion: ProgressionSuggestion) => {
    if (!suggestion.setWeights || suggestion.setWeights.length === 0) {
      toast({
        title: "Error",
        description: "Invalid weight suggestions received",
        variant: "destructive"
      });
      return;
    }
    setSelectedSuggestion(suggestion);
    console.log("Weights confirmed:", suggestion);
  };

  const getRestTimes = useCallback(() => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
  }, [currentExerciseData]);

  const handleStartWorkout = useCallback(() => {
    if (!selectedSuggestion || !selectedSuggestion.setWeights) {
      toast({
        title: "Select Weights",
        description: "Please confirm the weight selection before starting",
        variant: "destructive"
      });
      return;
    }

    try {
      setWorkoutState(prev => {
        const updatedExercises = prev.exercises.map(exercise => {
          if (exercise.exerciseId !== currentExerciseData?.exerciseId) return exercise;

          // Create sets with weights from suggestion
          const sets = selectedSuggestion.setWeights!.map((weight, idx) => ({
            weight,
            reps: selectedSuggestion.repTargets?.[idx]?.min || selectedSuggestion.reps,
            timestamp: new Date(),
            isCompleted: false
          }));

          return {
            ...exercise,
            sets,
            plannedSets: selectedSuggestion.sets
          };
        });

        return {
          ...prev,
          exercises: updatedExercises
        };
      });

      setCurrentView("active");
    } catch (error) {
      console.error('Error starting workout:', error);
      toast({
        title: "Error",
        description: "Failed to start workout. Please try again.",
        variant: "destructive"
      });
    }
  }, [selectedSuggestion, currentExerciseData, toast]);

  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);

      if (restTimer === 1) {
        const audio = new Audio("/notification.mp3");
        audio.play().catch(console.error);
      }
    }
    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!currentExerciseData || !workoutLogs?.length) return;

    const relevantLogs = workoutLogs
      .filter(log => log.sets.some(set => set.exerciseId === currentExerciseData.exerciseId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastLog = relevantLogs[0];
    if (lastLog) {
      const exerciseLog = lastLog.sets.find(set => set.exerciseId === currentExerciseData.exerciseId);
      if (exerciseLog?.oneRm) {
        setEditable1RM(Number(exerciseLog.oneRm.toFixed(2)));
      }
    }
  }, [currentExerciseData, workoutLogs]);

  const resolveConflict = (option: "local" | "cloud") => {
    if (option === "cloud" && conflict) {
      setWorkoutState(prev => ({ ...prev, exercises: conflict.sets.map(s => ({ ...s, sets: s.sets })) }));
    }
    setConflict(null);
  }

  if (!isOnline) {
    return (
      <Alert>
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          You are currently offline. Your workout data will be saved locally and synced when you reconnect.
        </AlertDescription>
      </Alert>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading workout data...</span>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error: Could not find exercise data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const renderProgressionSuggestions = () => {
    if (!progressionSuggestions.length) return null;

    const suggestion = progressionSuggestions[0];

    switch (currentExerciseData?.parameters.scheme) {
      default:
        return (
          <div className="space-y-2">
            <Label>Select a combination:</Label>
            <div className="space-y-2">
              <div className="p-4 rounded-md bg-muted">
                {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight.toFixed(2)}{currentExercise?.units}
                {suggestion.calculated1RM && (
                  <div className="text-sm text-muted-foreground mt-1">
                    1RM: {suggestion.calculated1RM.toFixed(2)}{currentExercise?.units}
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => handleUseWeights(suggestion)}
                variant={selectedSuggestion === suggestion ? "default" : "outline"}
              >
                {selectedSuggestion === suggestion ? "Weights Selected" : "Use These Weights"}
              </Button>
            </div>
          </div>
        );
    }
  };

  const renderSetInputs = (set: ExerciseSet, index: number) => {
    if (!set.isCompleted) {
      return (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label>Weight ({currentExercise?.units})</Label>
            <Input
              type="number"
              value={set.weight}
              onChange={(e) => {
                const newWeight = Number(e.target.value);
                setWorkoutState(prev => {
                  const updatedExercises = prev.exercises.map(exercise => {
                    if (exercise.exerciseId !== currentExerciseData?.exerciseId) return exercise;
                    const updatedSets = [...exercise.sets];
                    updatedSets[index] = { ...updatedSets[index], weight: newWeight };
                    return { ...exercise, sets: updatedSets };
                  });
                  return { ...prev, exercises: updatedExercises };
                });
              }}
              step={currentExercise?.increment}
            />
          </div>
          <div className="flex-1">
            <Label>Reps</Label>
            <Input
              type="number"
              value={set.reps}
              onChange={(e) => {
                const newReps = Number(e.target.value);
                setWorkoutState(prev => {
                  const updatedExercises = prev.exercises.map(exercise => {
                    if (exercise.exerciseId !== currentExerciseData?.exerciseId) return exercise;
                    const updatedSets = [...exercise.sets];
                    updatedSets[index] = { ...updatedSets[index], reps: newReps };
                    return { ...exercise, sets: updatedSets };
                  });
                  return { ...prev, exercises: updatedExercises };
                });
              }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  const manualForm = useForm<ManualInputForm>({
    resolver: zodResolver(manualInputSchema),
    defaultValues: {
      sets: 1,
      reps: 8,
      weight: currentExercise?.startingWeight || 0,
    },
  });

  const hasSuggestions = useMemo(() =>
    progressionSuggestions.length > 0,
    [progressionSuggestions]
  );

  const onManualSubmit = (data: ManualInputForm) => {
    try {
      const { sets, reps, weight } = data;
      const suggestion: ProgressionSuggestion = {
        sets,
        reps,
        weight,
        setWeights: Array(sets).fill(weight),
        calculated1RM: calculate1RM(weight, reps, sets),
      };

      handleUseWeights(suggestion);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process manual input",
        variant: "destructive",
      });
    }
  };

  // Fetch suggestion from API
  const { data: apiSuggestion } = useQuery<ProgressionSuggestion>({
    queryKey: [`/api/workout-suggestion?exerciseId=${currentExerciseData?.exerciseId}`],
    enabled: !!currentExerciseData?.exerciseId,
  });

  // Effect to set initial suggestion
  useEffect(() => {
    if (apiSuggestion && !selectedSuggestion) {
      setSelectedSuggestion(apiSuggestion);
    }
  }, [apiSuggestion, selectedSuggestion]);

  // Render suggestion card with improved layout
  const renderSuggestionCard = (suggestion: ProgressionSuggestion) => (
    <Card className={`transition-all duration-200 ${selectedSuggestion === suggestion ? 'border-primary' : ''}`}>
      <CardHeader>
        <CardTitle>Suggested Workout</CardTitle>
        <CardDescription>
          Based on your previous performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestion.setWeights?.map((weight, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span>Set {idx + 1}:</span>
            <span className="font-medium">
              {weight}{currentExercise?.units} × {suggestion.repTargets?.[idx]?.min || suggestion.reps} reps
            </span>
          </div>
        ))}
        {suggestion.calculated1RM && (
          <div className="mt-4 text-sm text-muted-foreground">
            Estimated 1RM: {suggestion.calculated1RM.toFixed(2)}{currentExercise?.units}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={selectedSuggestion === suggestion ? "default" : "outline"}
          onClick={() => handleUseWeights(suggestion)}
        >
          {selectedSuggestion === suggestion ? "Weights Selected" : "Use These Weights"}
        </Button>
      </CardFooter>
    </Card>
  );

  if (currentView === "setup") {
    return (
      <TooltipProvider>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{currentExercise.name} - Setup</CardTitle>
              <CardDescription>
                {apiSuggestion ? "Confirm your workout weights" : "Loading suggestion..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiSuggestion ? (
                renderSuggestionCard(apiSuggestion)
              ) : (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading suggestion...</span>
                </div>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full mt-4"
                    onClick={handleStartWorkout}
                    disabled={!selectedSuggestion}
                  >
                    Start Exercise
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedSuggestion ?
                    "Begin your workout with the selected weights" :
                    "Select a weight combination to start"
                  }
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-6">
      {!isOnline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Your workout data will be saved locally and synced when you reconnect.
          </AlertDescription>
        </Alert>
      )}
      {restTimer !== null && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Rest Time: {restTimer}s</span>
            {restTimer > 0 ? (
              <PauseCircle className="h-5 w-5 animate-pulse" />
            ) : (
              <PlayCircle className="h-5 w-5" />
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {currentExercise.name} - {currentExerciseData?.parameters.scheme}
          </CardTitle>
          <CardDescription>
            {completedSetsCount} of {currentState.plannedSets || 0} sets completed
            {currentExerciseData?.parameters.scheme === "STS" && currentState.oneRm && (
              <div className="mt-1 text-sm">
                Current 1RM: {currentState.oneRm.toFixed(2)}{currentExercise.units}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.isArray(currentState.sets) && currentState.sets.map((set, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Set {index + 1}</h3>
                {renderSetInputs(set, index)}
              </div>
              {!set.isCompleted && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const reps = prompt(`Enter actual reps achieved (target: ${set.reps})`);
                      if (reps !== null) {
                        handleSetComplete(index, true, parseInt(reps));
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Failed
                  </Button>
                  <Button
                    onClick={() => handleSetComplete(index, true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                </div>
              )}
            </div>
          ))}

          {remainingSets.length === 0 && !showExtraSetPrompt && (
            <Button
              className="w-full"
              onClick={() => {
                if (currentExerciseIndex < workoutDay.exercises.length - 1) {
                  setCurrentExerciseIndex(prev => prev + 1);
                } else {
                  saveAndExitWorkout();
                }
              }}
            >
              {currentExerciseIndex < workoutDay.exercises.length - 1 ? 'Next Exercise' : 'End Workout'}
            </Button>
          )}

          {showExtraSetPrompt && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Would you like to attempt an extra set after your rest period?
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleExtraSetComplete(null)}
                >
                  Skip Extra Set
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    const reps = prompt("Enter the number of reps achieved in the extra set:");
                    if (reps !== null) {
                      handleExtraSetComplete(parseInt(reps));
                    }
                  }}
                >
                  Log Extra Set
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={conflict !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workout Log Conflict</AlertDialogTitle>
            <AlertDialogDescription>
              There are changes both locally and on the server.
              Which version would you like to keep?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConflict("cloud")}>
              Use Server Version
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveConflict("local")}>
              Keep Local Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex gap-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={saveAndExitWorkout}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save & Exit'
          )}
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={onComplete}
          disabled={isLoading}
        >
          Discard
        </Button>
      </div>
    </div>
  );
};

export default WorkoutLogger;