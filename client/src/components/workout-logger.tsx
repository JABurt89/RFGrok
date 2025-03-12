import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog, Exercise, STSParameters, DoubleProgressionParameters, RPTTopSetParameters, RPTIndividualParameters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlayCircle, PauseCircle, CheckCircle, XCircle } from "lucide-react";
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
  const { data: exercises, isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const currentExerciseData = workoutDay.exercises[currentExerciseIndex];
  const currentExercise = exercises?.find(e => e.id === currentExerciseData?.exerciseId);
  const exerciseProgress = workoutState[currentExerciseData?.exerciseId || 0];

  // Get rest times from the current exercise's parameters
  const getRestTimes = () => {
    if (!currentExerciseData) return { setRest: 90, exerciseRest: 180 };
    return {
      setRest: currentExerciseData.parameters.restBetweenSets,
      exerciseRest: currentExerciseData.parameters.restBetweenExercises,
    };
  };

  // Calculate 1RM for STS
  const calculateSTS1RM = (weight: number, reps: number, sets: number, extraReps?: number) => {
    if (extraReps !== undefined) {
      const C = weight * (1 + 0.025 * reps) * (1 + 0.025 * (sets - 1));
      const F = weight * (1 + 0.025 * reps) * (1 + 0.025 * sets);
      return C + (extraReps / reps) * (F - C);
    }
    return weight * (1 + 0.025 * reps) * (1 + 0.025 * (sets - 1));
  };

  // Rest timer
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);

      // Play chime when timer expires
      if (restTimer === 1) {
        const audio = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
        audio.play();
      }
    }
    return () => clearInterval(interval);
  }, [restTimer]);

  // Save workout mutation
  const saveWorkoutMutation = useMutation({
    mutationFn: async (data: Partial<WorkoutLog>) => {
      const res = await apiRequest("POST", "/api/workout-logs", data);
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
    const timestamp = new Date().toISOString();
    const exerciseId = currentExerciseData?.exerciseId;

    setWorkoutState(prev => ({
      ...prev,
      [exerciseId || 0]: {
        ...prev[exerciseId || 0],
        sets: [...(prev[exerciseId || 0]?.sets || []), { reps, weight, timestamp }],
      },
    }));

    // Start rest timer
    const { setRest } = getRestTimes();
    setRestTimer(setRest);

    // Check if all planned sets are complete for STS
    if (currentExerciseData?.parameters.scheme === "STS") {
      const stsParams = currentExerciseData.parameters as STSParameters;
      if (workoutState[exerciseId || 0]?.sets.length === stsParams.maxSets -1 ) {
        setShowExtraSetPrompt(true);
      }
    }
  };

  const handleExtraSet = (reps: number) => {
    const exerciseId = currentExerciseData?.exerciseId;
    setWorkoutState(prev => ({
      ...prev,
      [exerciseId || 0]: {
        ...prev[exerciseId || 0],
        extraSetReps: reps,
      },
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
      const workoutLog = {
        workoutDayId: workoutDay.id,
        date: new Date(),
        sets: Object.entries(workoutState).map(([exerciseId, data]) => ({
          exerciseId: parseInt(exerciseId),
          sets: data.sets,
          extraSetReps: data.extraSetReps,
          oneRm: data.oneRm,
        })),
        isComplete: true,
      };

      saveWorkoutMutation.mutate(workoutLog);
    }
  };

  const handleSaveAndExit = () => {
    const workoutLog = {
      workoutDayId: workoutDay.id,
      date: new Date(),
      sets: Object.entries(workoutState).map(([exerciseId, data]) => ({
        exerciseId: parseInt(exerciseId),
        sets: data.sets,
        extraSetReps: data.extraSetReps,
        oneRm: data.oneRm,
      })),
      isComplete: false,
    };

    saveWorkoutMutation.mutate(workoutLog);
  };

  if (!currentExercise || isLoading) return <div>Loading...</div>;

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
            {currentExercise.name} - Set {(workoutState[currentExerciseData.exerciseId || 0]?.sets.length ?? 0) + 1}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Weight"
              id="weight"
            />
            <Input
              type="number"
              placeholder="Reps"
              id="reps"
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
            <DialogTitle>Attempt Extra Set?</DialogTitle>
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