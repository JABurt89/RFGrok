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

type WorkoutExercise = {
  exerciseId: number;
  sets: ExerciseSet[];
  extraSetReps?: number;
  oneRm?: number;
  selectedCombination?: STSCombination;
  plannedSets?: number;
};

type WorkoutState = {
  workoutDayId: number;
  exercises: WorkoutExercise[];
  date?: string;
  completed?: boolean;
  endTime?: string;
};

type STSCombination = {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM: number;
};

type WorkoutView = "setup" | "active";

export default function WorkoutLogger({ workoutDay, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<WorkoutView>("setup");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // Initialize workout state with empty exercises array
  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    workoutDayId: workoutDay.id,
    exercises: workoutDay.exercises.map(exercise => ({
      exerciseId: exercise.exerciseId,
      sets: [],
    }))
  });

  const [restTimer, setRestTimer] = useState<number | null>(null);
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

      // Ensure all sets arrays exist and are valid
      const payload = {
        ...workoutState,
        date: new Date().toISOString(),
        exercises: workoutState.exercises.map(exercise => ({
          ...exercise,
          sets: Array.isArray(exercise.sets) ? exercise.sets.map(set => ({
            ...set,
            timestamp: new Date().toISOString()
          })) : []
        })),
        completed: true,
        endTime: new Date().toISOString()
      };

      // Log the payload to verify sets arrays
      console.log('Saving workout with data:', JSON.stringify(payload, null, 2));

      const response = await apiRequest("POST", "/api/workout-logs", payload);
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

        const sets = Array.isArray(exercise.sets) ? [...exercise.sets] : [];
        sets[setIndex] = {
          ...sets[setIndex],
          isCompleted: completed,
          actualReps: actualReps || sets[setIndex].reps,
          timestamp: new Date().toISOString()
        };

        return {
          ...exercise,
          sets,
          oneRm: calculate1RM(
            sets[setIndex].weight,
            sets[setIndex].actualReps || sets[setIndex].reps,
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
            timestamp: new Date().toISOString(),
            isCompleted: false
          })),
          selectedCombination: combination,
          plannedSets: combination.sets
        };
      });

      return {
        ...prev,
        exercises: updatedExercises
      };
    });
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
                      value={workoutState.exercises[currentExerciseIndex]?.selectedCombination ?
                        JSON.stringify(workoutState.exercises[currentExerciseIndex].selectedCombination) :
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

  const currentState = workoutState.exercises[currentExerciseIndex] || { sets: [] };
  const remainingSets = (currentState.sets || []).filter(set => !set.isCompleted);

  const handleStartWorkout = () => {
    const currentState = workoutState.exercises[currentExerciseIndex];
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
            {(currentState.sets || []).filter(set => set.isCompleted).length || 0} of {currentState.plannedSets || 0} sets completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(currentState.sets || []).map((set, index) => (
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