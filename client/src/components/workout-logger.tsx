import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  timestamp: string | null;
  isCompleted: boolean;
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

export default function WorkoutLogger({ workoutDay, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<WorkoutView>("setup");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editable1RM, setEditable1RM] = useState<number>(100);
  const [stsCombinations, setStsCombinations] = useState<STSCombination[]>([]);

  const { data: exercises, isLoading: exercisesLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const currentExerciseData = workoutDay.exercises[currentExerciseIndex];
  const currentExercise = exercises?.find(e => e.id === currentExerciseData?.exerciseId);

  const calculate1RM = (weight: number, reps: number, sets: number): number => {
    const baseRM = weight * (1 + 0.025 * reps);
    return baseRM * (1 + 0.025 * (sets - 1));
  };

  useEffect(() => {
    if (!currentExercise || currentExerciseData?.parameters?.scheme !== "STS") return;

    const stsParams = currentExerciseData.parameters as STSParameters;
    const combinations: STSCombination[] = [];

    for (let sets = stsParams.minSets; sets <= stsParams.maxSets; sets++) {
      for (let reps = stsParams.minReps; reps <= stsParams.maxReps; reps++) {
        const targetWeight = editable1RM / (1 + 0.025 * reps) / (1 + 0.025 * (sets - 1));
        const weight = Math.ceil(targetWeight / currentExercise.increment) * currentExercise.increment;
        const calculated1RM = calculate1RM(weight, reps, sets);

        if (calculated1RM > editable1RM) {
          combinations.push({ sets, reps, weight, calculated1RM });
        }
      }
    }

    combinations.sort((a, b) => a.calculated1RM - b.calculated1RM);
    setStsCombinations(combinations.slice(0, 10));
  }, [editable1RM, currentExercise, currentExerciseData]);

  const saveAndExitWorkout = async () => {
    if (!currentExerciseData) return;

    setIsLoading(true);
    try {
      const workoutLog: Partial<WorkoutLog> = {
        workoutDayId: workoutDay.id,
        date: new Date().toISOString(),
        sets: Object.entries(workoutState).map(([exerciseId, data]) => ({
          exerciseId: parseInt(exerciseId),
          sets: data.sets.map(set => ({
            reps: set.actualReps ?? set.reps,
            weight: set.weight,
            timestamp: set.timestamp, // Already string | null
          })),
          extraSetReps: data.extraSetReps,
          oneRm: data.oneRm,
        })),
        isComplete: false,
      };

      console.log('Sending workout log:', JSON.stringify(workoutLog, null, 2));
      const response = await apiRequest("POST", "/api/workout-logs", workoutLog);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server error: ${JSON.stringify(errorData)}`);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Success", description: "Workout saved successfully!" });
      onComplete();
    } catch (error) {
      console.error("Failed to save workout:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save workout",
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
        actualReps: actualReps ?? currentSets[setIndex].reps,
        timestamp: completed ? new Date().toISOString() : null,
      };

      const updatedState = {
        ...prev,
        [exerciseId]: {
          ...prev[exerciseId],
          sets: currentSets,
          oneRm: calculate1RM(
            currentSets[setIndex].weight,
            currentSets[setIndex].actualReps ?? currentSets[setIndex].reps,
            currentSets.filter(s => s.isCompleted).length
          ),
        },
      };

      // Check if all sets are complete and prompt for next exercise
      if (currentSets.every(set => set.isCompleted) && currentExerciseIndex < workoutDay.exercises.length - 1) {
        setTimeout(() => setCurrentExerciseIndex(prev => prev + 1), 1000);
      }

      return updatedState;
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
        ...prev[exerciseId],
        sets: Array(combination.sets).fill(null).map(() => ({
          weight: combination.weight,
          reps: combination.reps,
          isCompleted: false,
          timestamp: null,
        })),
        selectedCombination: combination,
        plannedSets: combination.sets,
      },
    }));
  };

  const handleStartWorkout = () => {
    const currentState = workoutState[currentExerciseData?.exerciseId];
    if (!currentState?.sets?.length) {
      toast({
        title: "Setup Required",
        description: "Please select a set/weight combination first.",
        variant: "destructive",
      });
      return;
    }
    setCurrentView("active");
  };

  const getRestTimes = () => {
    return {
      setRest: currentExerciseData?.parameters.restBetweenSets ?? 90,
      exerciseRest: currentExerciseData?.parameters.restBetweenExercises ?? 180,
    };
  };

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;

    const interval = setInterval(() => {
      setRestTimer(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    if (restTimer === 1) {
      new Audio("/notification.mp3").play().catch(err => console.error("Audio error:", err));
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
        <AlertDescription>Exercise data not found. Please try again.</AlertDescription>
      </Alert>
    );
  }

  if (currentView === "setup") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{currentExercise.name} - Setup</CardTitle>
            <CardDescription>Select your target sets and weights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentExerciseData.parameters.scheme === "STS" && (
              <>
                <div className="space-y-2">
                  <Label>Current 1RM ({currentExercise.units})</Label>
                  <Input
                    type="number"
                    value={editable1RM}
                    onChange={e => setEditable1RM(parseFloat(e.target.value) || 0)}
                    step={currentExercise.increment}
                    min={0}
                  />
                </div>
                {stsCombinations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select a combination:</Label>
                    <RadioGroup
                      value={workoutState[currentExerciseData.exerciseId]?.selectedCombination
                        ? JSON.stringify(workoutState[currentExerciseData.exerciseId].selectedCombination)
                        : undefined}
                      onValueChange={value => handleCombinationSelect(JSON.parse(value))}
                    >
                      {stsCombinations.map((combo, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <RadioGroupItem value={JSON.stringify(combo)} id={`combo-${idx}`} />
                          <Label htmlFor={`combo-${idx}`}>
                            {combo.sets} sets × {combo.reps} reps @ {combo.weight} {currentExercise.units} (1RM: {combo.calculated1RM.toFixed(1)})
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </>
            )}
            <Button className="w-full" onClick={handleStartWorkout}>
              Start Exercise
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentState = workoutState[currentExerciseData.exerciseId];
  const remainingSets = currentState.sets.filter(set => !set.isCompleted);

  return (
    <div className="space-y-6">
      {restTimer !== null && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>Rest: {restTimer}s</span>
            {restTimer > 0 ? <PauseCircle className="h-5 w-5 animate-pulse" /> : <PlayCircle className="h-5 w-5" />}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{currentExercise.name}</CardTitle>
          <CardDescription>
            {currentState.sets.filter(s => s.isCompleted).length} of {currentState.plannedSets} sets completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentState.sets.map((set, index) => (
            <div key={index} className="border rounded-lg p-4 flex items-center justify-between">
              <h3 className="font-medium">Set {index + 1}</h3>
              {!set.isCompleted ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reps = prompt(`Enter reps (target: ${set.reps}):`);
                      if (reps !== null) handleSetComplete(index, true, parseInt(reps));
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Failed
                  </Button>
                  <Button size="sm" onClick={() => handleSetComplete(index, true)}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Complete
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {set.actualReps ?? set.reps} reps @ {set.weight} {currentExercise.units}
                </span>
              )}
            </div>
          ))}
          {remainingSets.length === 0 && currentExerciseIndex < workoutDay.exercises.length - 1 && (
            <Button className="w-full" onClick={() => setCurrentExerciseIndex(prev => prev + 1)}>
              Next Exercise
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="flex gap-4">
        <Button variant="outline" className="w-full" onClick={saveAndExitWorkout} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : (
            "Save & Exit"
          )}
        </Button>
        <Button variant="destructive" className="w-full" onClick={onComplete} disabled={isLoading}>
          Discard
        </Button>
      </div>
    </div>
  );
}