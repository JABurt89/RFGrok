import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise, STSParameters } from "@shared/schema";
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
  const [stsCombinations, setStsCombinations] = useState<STSCombination[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch exercises
  const { data: exercises, isLoading: exercisesLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // Fetch workout logs
  const { data: workoutLogs = [] } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs"],
  });

  const currentExerciseData = workoutDay.exercises[currentExerciseIndex];
  const currentExercise = exercises?.find(e => e.id === currentExerciseData?.exerciseId);

  // Initialize editable1RM with the most recent calculated 1RM
  useEffect(() => {
    if (!currentExerciseData || !workoutLogs?.length) return;

    // Find the most recent workout log for this exercise
    const relevantLogs = workoutLogs
      .filter(log => log.sets.some(set => set.exerciseId === currentExerciseData.exerciseId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastLog = relevantLogs[0];
    if (lastLog) {
      const exerciseLog = lastLog.sets.find(set => set.exerciseId === currentExerciseData.exerciseId);
      if (exerciseLog?.oneRm) {
        // Round to 2 decimal places when setting the value
        setEditable1RM(Number(exerciseLog.oneRm.toFixed(2)));
      }
    }
  }, [currentExerciseData, workoutLogs]);

  const calculate1RM = (weight: number, reps: number, sets: number): number => {
    // Brzycki formula for 1RM calculation
    const baseRM = Number(weight) * (36 / (37 - Number(reps)));
    // Add 2.5% per additional set
    return Number((baseRM * (1 + 0.025 * (Number(sets) - 1))).toFixed(2));
  };

  const saveAndExitWorkout = async () => {
    try {
      setIsLoading(true);

      // Create workout payload with proper type conversions
      const workoutLog: WorkoutLog = {
        workoutDayId: Number(workoutDay.id),
        date: new Date().toISOString(), // Convert to ISO string for consistent formatting
        sets: workoutState.exercises.map(exercise => ({
          exerciseId: Number(exercise.exerciseId),
          sets: (exercise.sets || []).map(set => ({
            reps: Number(set.actualReps || set.reps),
            weight: Number(set.weight),
            timestamp: new Date(set.timestamp).toISOString() // Convert to ISO string
          })),
          extraSetReps: exercise.extraSetReps ? Number(exercise.extraSetReps) : undefined,
          oneRm: exercise.oneRm ? Number(exercise.oneRm) : undefined
        })),
        isComplete: true
      };

      console.log('Saving workout with data:', JSON.stringify(workoutLog, null, 2));

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
  };

  const handleSetComplete = (setIndex: number, completed: boolean, actualReps?: number) => {
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

        return {
          ...exercise,
          sets,
          oneRm: calculate1RM(
            Number(sets[setIndex].weight),
            Number(sets[setIndex].actualReps || sets[setIndex].reps),
            setIndex + 1
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
  };

  const handleCombinationSelect = (combination: STSCombination) => {
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
  };

  useEffect(() => {
    if (!currentExercise || !currentExerciseData?.parameters?.scheme === "STS") return;

    const stsParams = currentExerciseData.parameters as STSParameters;
    const combinations: STSCombination[] = [];

    for (let sets = stsParams.minSets; sets <= stsParams.maxSets; sets++) {
      for (let reps = stsParams.minReps; reps <= stsParams.maxReps; reps++) {
        // Calculate target weight using reverse Brzycki formula
        // First remove the set bonus from the target 1RM
        const targetWithoutSetBonus = editable1RM / (1 + 0.025 * (sets - 1));
        // Then calculate the working weight needed to achieve this 1RM
        const targetWeight = targetWithoutSetBonus * ((37 - reps) / 36);

        // Round to nearest increment
        const roundedWeight = Number(
          (Math.round(targetWeight / currentExercise.increment) * currentExercise.increment).toFixed(2)
        );

        // Calculate what 1RM this rounded weight would actually produce
        const calculated1RM = calculate1RM(roundedWeight, reps, sets);

        // Only include combinations that would produce a higher 1RM than the current one
        // Require at least a 0.5% increase to ensure progression
        if (calculated1RM > editable1RM * 1.005) {
          combinations.push({
            sets,
            reps,
            weight: roundedWeight,
            calculated1RM: Number(calculated1RM.toFixed(2))
          });
        }
      }
    }

    // Sort by how close the calculated 1RM is to the target progressive overload
    // Target is current 1RM + 2.5% for optimal progression
    const targetProgression = editable1RM * 1.025;
    combinations.sort((a, b) =>
      Math.abs(targetProgression - a.calculated1RM) - Math.abs(targetProgression - b.calculated1RM)
    );
    setStsCombinations(combinations.slice(0, 10));
  }, [editable1RM, currentExercise, currentExerciseData]);

  const getRestTimes = () => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
  };

  const handleStartWorkout = () => {
    const currentState = workoutState.exercises[currentExerciseIndex];
    if (!Array.isArray(currentState?.sets) || currentState.sets.length === 0) {
      toast({
        title: "Select a combination",
        description: "Please select a set/weight combination before starting the workout",
        variant: "destructive"
      });
      return;
    }
    setCurrentView("active");
  };

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

  if (exercisesLoading) {
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
                      value={workoutState.exercises[currentExerciseIndex]?.plannedSets ?
                        JSON.stringify({
                          sets: workoutState.exercises[currentExerciseIndex].plannedSets,
                          reps: workoutState.exercises[currentExerciseIndex].sets[0]?.reps,
                          weight: Number(workoutState.exercises[currentExerciseIndex].sets[0]?.weight.toFixed(2)),
                          calculated1RM: calculate1RM(
                            workoutState.exercises[currentExerciseIndex].sets[0]?.weight || 0,
                            workoutState.exercises[currentExerciseIndex].sets[0]?.reps || 0,
                            workoutState.exercises[currentExerciseIndex].plannedSets || 0
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

  const currentState = workoutState.exercises[currentExerciseIndex] || { sets: [] };
  const remainingSets = Array.isArray(currentState.sets) ?
    currentState.sets.filter(set => !set.isCompleted) :
    [];

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
            {Array.isArray(currentState.sets) ?
              currentState.sets.filter(set => set.isCompleted).length : 0} of {currentState.plannedSets || 0} sets completed
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

          {remainingSets.length === 0 && (
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