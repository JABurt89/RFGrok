import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise, STSParameters } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlayCircle, PauseCircle, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type WorkoutLoggerProps = {
  workoutDay: WorkoutDay;
  onComplete: () => void;
};

type ExerciseSet = {
  reps: number;
  weight: number;
  timestamp: Date | string;
  isCompleted?: boolean;
  actualReps?: number;
};

type WorkoutExercise = {
  exerciseId: number;
  scheme: string;
  sets: ExerciseSet[];
  extraSetReps?: number;
  oneRm?: number;
  plannedSets?: number;
};

type WorkoutState = {
  workoutDayId: number;
  date: Date;
  exercises: WorkoutExercise[];
  isComplete?: boolean;
};

type STSCombination = {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM: number;
};

type WorkoutView = "setup" | "active";

const WorkoutLogger = ({ workoutDay, onComplete }: WorkoutLoggerProps) => {
  const { toast } = useToast();
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

  const calculate1RM = useCallback((weight: number, reps: number, sets: number, extraSetReps?: number): number => {
    if (typeof extraSetReps === 'number') {
      const C = Number(weight) * (36 / (37 - Number(reps))) * (1 + 0.025 * (Number(sets) - 1));
      const F = Number(weight) * (36 / (37 - Number(reps))) * (1 + 0.025 * Number(sets));
      if (extraSetReps === 0) return Number(C.toFixed(2));
      return Number((C + (extraSetReps / reps) * (F - C)).toFixed(2));
    }

    const baseRM = Number(weight) * (36 / (37 - Number(reps)));
    return Number((baseRM * (1 + 0.025 * (Number(sets) - 1))).toFixed(2));
  }, []);

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

      const response = await apiRequest("POST", "/api/workout-logs", workoutLog);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save workout: ${JSON.stringify(errorData)}`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({
        title: "Success",
        description: "Workout saved successfully!",
      });
      onComplete();
    } catch (error) {
      console.error('Error saving workout:', error);
      toast({
        title: "Error saving workout",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [workoutDay.id, workoutState, toast, onComplete]);

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

        const allSetsCompleted = sets.every(set => set.isCompleted);
        if (allSetsCompleted && currentExerciseData.parameters.scheme === "STS") {
          setShowExtraSetPrompt(true);
        }

        return {
          ...exercise,
          sets,
          oneRm: calculate1RM(
            Number(sets[setIndex].weight),
            Number(sets[setIndex].actualReps || sets[setIndex].reps),
            setIndex + 1,
            exercise.extraSetReps
          )
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });

    const { setRest } = getRestTimes();
    setRestTimer(setRest);
  }, [currentExerciseData, calculate1RM]);

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
          oneRm: calculate1RM(
            Number(lastSet.weight),
            Number(lastSet.reps),
            exercise.sets.length,
            reps
          )
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });

    setShowExtraSetPrompt(false);
  }, [currentExerciseData, calculate1RM]);

  const handleCombinationSelect = useCallback((combination: STSCombination) => {
    if (!currentExerciseData) return;

    setWorkoutState(prev => {
      const updatedExercises = prev.exercises.map(exercise => {
        if (exercise.exerciseId !== currentExerciseData.exerciseId) return exercise;

        return {
          ...exercise,
          sets: Array(combination.sets).fill(null).map(() => ({
            weight: combination.weight,
            reps: combination.reps,
            timestamp: new Date(),
            isCompleted: false
          })),
          plannedSets: combination.sets
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });
  }, [currentExerciseData]);

  const getRestTimes = useCallback(() => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
  }, [currentExerciseData]);

  const handleStartWorkout = useCallback(() => {
    if (!Array.isArray(currentState?.sets) || currentState.sets.length === 0) {
      toast({
        title: "Select a combination",
        description: "Please select a set/weight combination before starting the workout",
        variant: "destructive"
      });
      return;
    }
    setCurrentView("active");
  }, [currentState, toast]);

  const stsCombinations = useMemo(() => {
    if (!currentExercise || currentExerciseData?.parameters?.scheme !== "STS") return [];

    const stsParams = currentExerciseData.parameters as STSParameters;
    const combinations: STSCombination[] = [];

    for (let sets = stsParams.minSets; sets <= stsParams.maxSets; sets++) {
      for (let reps = stsParams.minReps; reps <= stsParams.maxReps; reps++) {
        const targetWithoutSetBonus = editable1RM / (1 + 0.025 * (sets - 1));
        const targetWeight = targetWithoutSetBonus * ((37 - reps) / 36);

        for (let i = -2; i <= 2; i++) {
          const adjustedWeight = targetWeight + (i * currentExercise.increment);
          const roundedWeight = Number(
            (Math.round(adjustedWeight / currentExercise.increment) * currentExercise.increment).toFixed(2)
          );

          const calculated1RM = calculate1RM(roundedWeight, reps, sets);

          if (calculated1RM > editable1RM) {
            combinations.push({
              sets,
              reps,
              weight: roundedWeight,
              calculated1RM: Number(calculated1RM.toFixed(2))
            });
          }
        }
      }
    }

    return combinations.sort((a, b) => a.calculated1RM - b.calculated1RM).slice(0, 10);
  }, [currentExercise, currentExerciseData, editable1RM, calculate1RM]);


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

  if (currentView === "setup") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{currentExercise.name} - Setup</CardTitle>
            <CardDescription>
              Select your target sets and weights for this exercise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentExerciseData.parameters.scheme === "STS" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current 1RM ({currentExercise.units})</Label>
                  <Input
                    type="number"
                    value={editable1RM}
                    onChange={(e) => setEditable1RM(Number(Number(e.target.value).toFixed(2)) || 0)}
                    step={currentExercise.increment}
                  />
                </div>

                {stsCombinations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select a combination:</Label>
                    <RadioGroup
                      value={currentState.plannedSets ?
                        JSON.stringify({
                          sets: currentState.plannedSets,
                          reps: currentState.sets[0]?.reps,
                          weight: Number(currentState.sets[0]?.weight.toFixed(2)),
                          calculated1RM: calculate1RM(
                            currentState.sets[0]?.weight || 0,
                            currentState.sets[0]?.reps || 0,
                            currentState.plannedSets || 0
                          )
                        }) :
                        undefined}
                      onValueChange={(value) => handleCombinationSelect(JSON.parse(value))}
                    >
                      <div className="space-y-2">
                        {stsCombinations.map((combo, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={JSON.stringify(combo)} id={`combo-${idx}`} />
                            <Label htmlFor={`combo-${idx}`}>
                              {combo.sets} sets × {combo.reps} reps @ {combo.weight.toFixed(2)}{currentExercise.units}
                              <span className="text-sm text-muted-foreground ml-2">
                                (1RM: {combo.calculated1RM.toFixed(2)}{currentExercise.units})
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleStartWorkout}
            >
              Start Exercise
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            {currentExercise.name} - Active Workout
          </CardTitle>
          <CardDescription>
            {completedSetsCount} of {currentState.plannedSets || 0} sets completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.isArray(currentState.sets) && currentState.sets.map((set, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Set {index + 1}</h3>
                <div className="flex items-center gap-2">
                  {!set.isCompleted ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reps = prompt(`Enter actual reps achieved (target: ${set.reps}):`)
                          if (reps !== null) {
                            handleSetComplete(index, true, parseInt(reps));
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Failed Set
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSetComplete(index, true)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Set
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {set.actualReps || set.reps} reps @ {set.weight.toFixed(2)}{currentExercise.units}
                    </span>
                  )}
                </div>
              </div>
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