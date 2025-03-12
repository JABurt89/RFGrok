import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise, STSParameters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlayCircle, PauseCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  };
};

export default function WorkoutLogger({ workoutDay, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutState, setWorkoutState] = useState<WorkoutState>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [showExtraSetPrompt, setShowExtraSetPrompt] = useState(false);

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

  // Calculate 1RM for STS progression
  const calculate1RM = (weight: number, reps: number, sets: number) => {
    return weight * (1 + 0.025 * reps) * (1 + 0.025 * (sets - 1));
  };

  // Generate suggestions for exercises
  const generateSuggestions = (exerciseId: number) => {
    const exercise = exercises?.find(e => e.id === exerciseId);
    if (!exercise) return null;

    const lastLog = workoutLogs?.find(log => 
      log.sets.some(s => s.exerciseId === exerciseId) && log.isComplete
    );

    // For first-time exercises, use starting weight
    if (!lastLog) {
      return {
        weight: exercise.startingWeight,
        suggestedSets: currentExerciseData?.parameters.scheme === "STS" 
          ? (currentExerciseData?.parameters as STSParameters).minSets
          : 3,
        suggestedReps: currentExerciseData?.parameters.scheme === "STS"
          ? (currentExerciseData?.parameters as STSParameters).minReps
          : 8
      };
    }

    // Calculate based on last performance
    const relevantSet = lastLog?.sets.find(s => s.exerciseId === exerciseId);
    if (!relevantSet) return null;

    const lastOneRm = relevantSet.oneRm || calculate1RM(
      relevantSet.sets[0].weight,
      relevantSet.sets[0].reps,
      relevantSet.sets.length
    );

    return {
      weight: relevantSet.sets[0].weight + exercise.increment,
      suggestedSets: relevantSet.sets.length,
      suggestedReps: relevantSet.sets[0].reps,
      lastOneRm
    };
  };

  const suggestions = currentExercise ? generateSuggestions(currentExercise.id) : null;

  // Rest timer
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);

      // Play chime when timer expires
      if (restTimer === 1) {
        const audio = new Audio("/notification.mp3"); //This path might need adjustment
        audio.play().catch(console.error); // Ignore autoplay blocking
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

  const handleExtraSet = (reps: number) => {
    if (!currentExerciseData) return;

    const exerciseId = currentExerciseData.exerciseId;
    setWorkoutState(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        extraSetReps: reps
      }
    }));
    setShowExtraSetPrompt(false);
    moveToNextExercise();
  };

  const moveToNextExercise = () => {
    if (currentExerciseIndex < workoutDay.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      const { exerciseRest } = getRestTimes();
      setRestTimer(exerciseRest);
    } else {
      // Workout complete, prepare workout log
      const workoutLog: Partial<WorkoutLog> = {
        workoutDayId: workoutDay.id,
        date: new Date(),
        sets: Object.entries(workoutState).map(([exerciseId, data]) => ({
          exerciseId: parseInt(exerciseId),
          sets: data.sets,
          extraSetReps: data.extraSetReps,
          oneRm: data.oneRm,
        })),
        isComplete: true
      };

      saveWorkoutMutation.mutate(workoutLog);
    }
  };

  const handleSaveAndExit = () => {
    if (!currentExerciseData) return;

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
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestions && (
            <Alert>
              <AlertDescription>
                Suggested: {suggestions.suggestedSets} sets × {suggestions.suggestedReps} reps @ {suggestions.weight}{currentExercise.units}
                {suggestions.lastOneRm && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Last 1RM: {suggestions.lastOneRm.toFixed(1)}{currentExercise.units}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Weight"
              id="weight"
              defaultValue={suggestions?.weight.toString()}
            />
            <Input
              type="number"
              placeholder="Reps"
              id="reps"
              defaultValue={suggestions?.suggestedReps.toString()}
            />
          </div>
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
        </CardContent>
      </Card>

      {/* Extra Set Prompt */}
      <Dialog open={showExtraSetPrompt} onOpenChange={setShowExtraSetPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extra Set</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            placeholder="Enter reps achieved"
            id="extraSetReps"
          />
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
        <Button variant="outline" className="w-full" onClick={handleSaveAndExit}>
          Save & Exit
        </Button>
        <Button variant="destructive" className="w-full" onClick={onComplete}>
          Discard
        </Button>
      </div>
    </div>
  );
}