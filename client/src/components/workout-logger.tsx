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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type WorkoutLoggerProps = {
  workoutDay: WorkoutDay;
  onComplete: () => void;
};

type ExerciseSet = {
  reps: number;
  weight: number;
  timestamp: string;
  isCompleted?: boolean;
  actualReps?: number;
};

type WorkoutState = {
  [exerciseId: number]: {
    sets: ExerciseSet[];
    extraSetReps?: number;
    oneRm?: number;
    selectedCombination?: STSCombination;
    plannedSets?: number;
  };
};

type STSCombination = {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM: number;
};

type WorkoutView = "setup" | "active";

// Function to serialize dates to ISO strings
const serializeDates = (obj: any): any => {
  if (obj instanceof Date) {
    return obj.toISOString();
  } else if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeDates(value)])
    );
  }
  return obj;
};

// Helper function to ensure valid date format
const ensureValidDate = (dateInput: Date | string | number | undefined | null): string => {
  try {
    if (!dateInput) {
      console.warn('No date provided, using current time');
      return new Date().toISOString();
    }

    if (dateInput instanceof Date) {
      return dateInput.toISOString();
    }

    if (typeof dateInput === 'number') {
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    if (typeof dateInput === 'string') {
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    console.warn('Invalid date input, using current time:', dateInput);
    return new Date().toISOString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toISOString();
  }
};

export default function WorkoutLogger({ workoutDay, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<WorkoutView>("setup");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [showExtraSetPrompt, setShowExtraSetPrompt] = useState(false);
  const [editable1RM, setEditable1RM] = useState<number>(100);
  const [stsCombinations, setStsCombinations] = useState<STSCombination[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: exercises, isLoading: exercisesLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const currentExerciseData = workoutDay.exercises[currentExerciseIndex];
  const currentExercise = exercises?.find(e => e.id === currentExerciseData?.exerciseId);

  const calculate1RM = (weight: number, reps: number, sets: number) => {
    const baseRM = weight * (36 / (37 - reps));
    return baseRM * (1 + 0.025 * (sets - 1));
  };

  const saveAndExitWorkout = async () => {
    try {
      setIsLoading(true);

      // Create a proper workout log with valid timestamps
      const workoutLog: Partial<WorkoutLog> = {
        workoutDayId: workoutDay.id,
        date: ensureValidDate(new Date()),
        sets: Object.entries(workoutState).map(([exerciseId, data]) => {
          // Process each set to ensure valid timestamps
          const processedSets = data.sets.map(set => ({
            reps: set.actualReps || set.reps,
            weight: set.weight,
            timestamp: ensureValidDate(set.timestamp)
          }));

          return {
            exerciseId: parseInt(exerciseId),
            sets: processedSets,
            extraSetReps: data.extraSetReps,
            oneRm: data.oneRm,
          };
        }),
        isComplete: false
      };

      // Serialize all dates to ensure proper format
      const serializedWorkoutLog = serializeDates(workoutLog);
      console.log('Saving workout with data:', JSON.stringify(serializedWorkoutLog, null, 2));

      const response = await apiRequest("POST", "/api/workout-logs", serializedWorkoutLog);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error saving workout: ${JSON.stringify(errorData)}`);
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

    const exerciseId = currentExerciseData.exerciseId;
    setWorkoutState(prev => {
      const currentSets = [...(prev[exerciseId]?.sets || [])];
      currentSets[setIndex] = {
        ...currentSets[setIndex],
        isCompleted: completed,
        actualReps: actualReps || currentSets[setIndex].reps,
        timestamp: ensureValidDate(new Date())
      };

      return {
        ...prev,
        [exerciseId]: {
          ...prev[exerciseId],
          sets: currentSets,
          oneRm: calculate1RM(
            currentSets[setIndex].weight,
            currentSets[setIndex].actualReps || currentSets[setIndex].reps,
            setIndex + 1
          )
        }
      };
    });

    const { setRest } = getRestTimes();
    setRestTimer(setRest);
  };

  const handleCombinationSelect = (combination: STSCombination) => {
    if (!currentExerciseData) return;

    const exerciseId = currentExerciseData.exerciseId;
    setWorkoutState(prev => ({
      ...prev,
      [exerciseId]: {
        sets: Array(combination.sets).fill(null).map(() => ({
          weight: combination.weight,
          reps: combination.reps,
          timestamp: ensureValidDate(new Date()),
          isCompleted: false
        })),
        selectedCombination: combination,
        plannedSets: combination.sets
      }
    }));
  };

  const handleStartWorkout = () => {
    const currentState = workoutState[currentExerciseData.exerciseId];
    if (!currentState?.sets?.length) {
      toast({
        title: "Select a combination",
        description: "Please select a set/weight combination before starting the workout",
        variant: "destructive"
      });
      return;
    }
    setCurrentView("active");
  };

  const getRestTimes = () => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
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

  useEffect(() => {
    if (!currentExercise || !currentExerciseData?.parameters?.scheme === "STS") return;

    const stsParams = currentExerciseData.parameters as STSParameters;
    const combinations: STSCombination[] = [];

    for (let sets = stsParams.minSets; sets <= stsParams.maxSets; sets++) {
      for (let reps = stsParams.minReps; reps <= stsParams.maxReps; reps++) {
        const targetWeight = editable1RM / (36 / (37 - reps)) / (1 + 0.025 * (sets - 1));
        const weight = Math.ceil(targetWeight / currentExercise.increment) * currentExercise.increment;

        const calculated1RM = calculate1RM(weight, reps, sets);
        if (calculated1RM > editable1RM * 0.95) { // Allow for slight variations
          combinations.push({ sets, reps, weight, calculated1RM });
        }
      }
    }

    combinations.sort((a, b) => a.calculated1RM - b.calculated1RM);
    setStsCombinations(combinations.slice(0, 10));
  }, [editable1RM, currentExercise, currentExerciseData]);


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
                    onChange={(e) => setEditable1RM(parseFloat(e.target.value) || 0)}
                    step={currentExercise.increment}
                  />
                </div>

                {stsCombinations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select a combination:</Label>
                    <RadioGroup
                      value={workoutState[currentExerciseData.exerciseId]?.selectedCombination ?
                        JSON.stringify(workoutState[currentExerciseData.exerciseId].selectedCombination) :
                        undefined}
                      onValueChange={(value) => handleCombinationSelect(JSON.parse(value))}
                    >
                      <div className="space-y-2">
                        {stsCombinations.map((combo, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={JSON.stringify(combo)} id={`combo-${idx}`} />
                            <Label htmlFor={`combo-${idx}`}>
                              {combo.sets} sets × {combo.reps} reps @ {combo.weight}{currentExercise.units}
                              <span className="text-sm text-muted-foreground ml-2">
                                (1RM: {combo.calculated1RM.toFixed(1)}{currentExercise.units})
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

  const currentState = workoutState[currentExerciseData.exerciseId];
  const remainingSets = currentState?.sets.filter(set => !set.isCompleted) || [];

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
            {currentState?.sets.filter(set => set.isCompleted).length || 0} of {currentState?.plannedSets || 0} sets completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentState?.sets.map((set, index) => (
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
                      {set.actualReps || set.reps} reps @ {set.weight}{currentExercise.units}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {remainingSets.length === 0 && (
            <Button
              className="w-full"
              onClick={() => setCurrentExerciseIndex(prev => prev + 1)}
            >
              Next Exercise
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
}