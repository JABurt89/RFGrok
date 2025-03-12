import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise, STSParameters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlayCircle, PauseCircle } from "lucide-react";
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
};

type WorkoutState = {
  [exerciseId: number]: {
    sets: ExerciseSet[];
    extraSetReps?: number;
    oneRm?: number;
    selectedCombination?: STSCombination;
  };
};

type STSCombination = {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM: number;
};

export default function WorkoutLogger({ workoutDay, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [showExtraSetPrompt, setShowExtraSetPrompt] = useState(false);
  const [editable1RM, setEditable1RM] = useState<number>(100); // Default 1RM
  const [stsCombinations, setStsCombinations] = useState<STSCombination[]>([]);

  // Fetch exercises data
  const { data: exercises, isLoading: exercisesLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // Fetch workout logs to check history
  const { data: workoutLogs, isLoading: logsLoading } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs"],
  });

  const currentExerciseData = workoutDay.exercises[currentExerciseIndex];
  const currentExercise = exercises?.find(e => e.id === currentExerciseData?.exerciseId);

  // Get last workout log for the current exercise
  const lastWorkoutLog = workoutLogs?.find(log => 
    log.sets.find(s => s.exerciseId === currentExerciseData?.exerciseId) && log.isComplete
  );

  // Calculate 1RM for progression schemes
  const calculate1RM = (weight: number, reps: number, sets: number) => {
    // Brzycki Formula with set multiplier
    const baseRM = weight * (36 / (37 - reps));
    return baseRM * (1 + 0.025 * (sets - 1));
  };

  // Generate STS combinations
  useEffect(() => {
    if (!currentExercise || !currentExerciseData?.parameters.scheme === "STS") return;

    const stsParams = currentExerciseData.parameters as STSParameters;
    const combinations: STSCombination[] = [];

    // Generate combinations based on the editable 1RM
    for (let sets = stsParams.minSets; sets <= stsParams.maxSets; sets++) {
      for (let reps = stsParams.minReps; reps <= stsParams.maxReps; reps++) {
        // Calculate weight that would give slightly higher 1RM
        const targetWeight = editable1RM / (36 / (37 - reps)) / (1 + 0.025 * (sets - 1));
        const weight = Math.ceil(targetWeight / currentExercise.increment) * currentExercise.increment;

        const calculated1RM = calculate1RM(weight, reps, sets);
        if (calculated1RM > editable1RM) {
          combinations.push({ sets, reps, weight, calculated1RM });
        }
      }
    }

    // Sort by smallest 1RM increase and take top 10
    combinations.sort((a, b) => a.calculated1RM - b.calculated1RM);
    setStsCombinations(combinations.slice(0, 10));
  }, [editable1RM, currentExercise, currentExerciseData]);

  // Rest timer
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

  // Save workout mutation
  const saveWorkoutMutation = useMutation({
    mutationFn: async (workoutLog: Partial<WorkoutLog>) => {
      const res = await apiRequest("POST", "/api/workout-logs", workoutLog);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({
        title: "Workout saved",
        description: "Your workout has been saved successfully",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving workout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSetComplete = (reps: number, weight: number) => {
    if (!currentExerciseData) return;

    const timestamp = new Date().toISOString();
    const exerciseId = currentExerciseData.exerciseId;

    setWorkoutState(prev => {
      const updatedSets = [...(prev[exerciseId]?.sets || []), { reps, weight, timestamp }];
      const oneRm = calculate1RM(weight, reps, updatedSets.length);

      return {
        ...prev,
        [exerciseId]: {
          ...prev[exerciseId],
          sets: updatedSets,
          oneRm
        }
      };
    });

    // Start rest timer
    const { setRest } = getRestTimes();
    setRestTimer(setRest);

    // Check if all planned sets are complete for STS
    if (currentExerciseData.parameters.scheme === "STS") {
      const stsParams = currentExerciseData.parameters as STSParameters;
      if (workoutState[exerciseId]?.sets.length === stsParams.maxSets - 1) {
        setShowExtraSetPrompt(true);
      }
    }
  };

  const getRestTimes = () => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
  };

  const handleCombinationSelect = (combination: STSCombination) => {
    if (!currentExerciseData) return;

    const exerciseId = currentExerciseData.exerciseId;
    setWorkoutState(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        selectedCombination: combination
      }
    }));

    // Auto-fill the input fields
    const weightInput = document.getElementById("weight") as HTMLInputElement;
    const repsInput = document.getElementById("reps") as HTMLInputElement;
    if (weightInput && repsInput) {
      weightInput.value = combination.weight.toString();
      repsInput.value = combination.reps.toString();
    }
  };

  if (exercisesLoading || logsLoading) {
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

  const lastSet = workoutState[currentExerciseData.exerciseId]?.sets.slice(-1)[0];

  return (
    <div className="space-y-6">
      {/* Rest Timer */}
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

      {/* Current Exercise */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentExercise.name} - Set {(workoutState[currentExerciseData.exerciseId]?.sets.length ?? 0) + 1}
          </CardTitle>
          {currentExerciseData.parameters.scheme === "STS" && (
            <CardDescription>
              Target: {currentExerciseData.parameters.minSets}-{currentExerciseData.parameters.maxSets} sets × {currentExerciseData.parameters.minReps}-{currentExerciseData.parameters.maxReps} reps
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 1RM Input for STS */}
          {currentExerciseData.parameters.scheme === "STS" && (
            <div className="space-y-2">
              <Label>Current 1RM ({currentExercise.units})</Label>
              <Input
                type="number"
                value={editable1RM}
                onChange={(e) => setEditable1RM(parseFloat(e.target.value) || 0)}
                step={currentExercise.increment}
              />
            </div>
          )}

          {/* STS Combinations */}
          {currentExerciseData.parameters.scheme === "STS" && stsCombinations.length > 0 && (
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

          {/* Weight and Reps Input */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Weight ({currentExercise.units})</Label>
              <Input
                type="number"
                id="weight"
                step={currentExercise.increment}
                defaultValue={lastSet?.weight.toString()}
              />
            </div>
            <div>
              <Label>Reps</Label>
              <Input
                type="number"
                id="reps"
                defaultValue={lastSet?.reps.toString()}
              />
            </div>
          </div>

          {/* Complete Set Button */}
          <Button 
            className="w-full"
            onClick={() => {
              const weight = parseFloat((document.getElementById("weight") as HTMLInputElement)?.value || "0");
              const reps = parseInt((document.getElementById("reps") as HTMLInputElement)?.value || "0");
              if (!isNaN(weight) && !isNaN(reps)) {
                handleSetComplete(reps, weight);
              }
            }}
          >
            Complete Set
          </Button>

          {/* Last Set Info */}
          {lastSet && (
            <Alert>
              <AlertDescription>
                Last set: {lastSet.weight}{currentExercise.units} × {lastSet.reps} reps
                {workoutState[currentExerciseData.exerciseId]?.oneRm && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Estimated 1RM: {workoutState[currentExerciseData.exerciseId].oneRm.toFixed(1)}{currentExercise.units}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Extra Set Dialog */}
      <Dialog open={showExtraSetPrompt} onOpenChange={setShowExtraSetPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extra Set Available</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Enter reps achieved (optional)</Label>
            <Input
              type="number"
              placeholder="Enter reps achieved"
              id="extraSetReps"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleExtraSet(0)}>
              Skip
            </Button>
            <Button onClick={() => {
              const reps = parseInt((document.getElementById("extraSetReps") as HTMLInputElement)?.value || "0");
              if (!isNaN(reps)) {
                handleExtraSet(reps);
              }
            }}>
              Save Extra Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Controls */}
      <div className="flex gap-4">
        <Button variant="outline" className="w-full" onClick={() => {
          const workoutLog: Partial<WorkoutLog> = {
            workoutDayId: workoutDay.id,
            date: new Date(),
            sets: Object.entries(workoutState).map(([exerciseId, data]) => ({
              exerciseId: parseInt(exerciseId),
              sets: data.sets,
              extraSetReps: data.extraSetReps,
              oneRm: data.oneRm,
            })),
            isComplete: false
          };
          saveWorkoutMutation.mutate(workoutLog);
        }}>
          Save & Exit
        </Button>
        <Button variant="destructive" className="w-full" onClick={onComplete}>
          Discard
        </Button>
      </div>
    </div>
  );
}