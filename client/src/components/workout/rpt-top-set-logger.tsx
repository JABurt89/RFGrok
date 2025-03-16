```typescript
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { RPTTopSetParameters } from "@shared/schema";
import { BaseWorkoutLogger, BaseWorkoutLoggerProps, WorkoutSet } from "./base-workout-logger";

interface RPTTopSetLoggerProps extends BaseWorkoutLoggerProps {
  parameters: RPTTopSetParameters;
}

export function RPTTopSetLogger(props: RPTTopSetLoggerProps) {
  const base = BaseWorkoutLogger(props);
  const [showRepsInput, setShowRepsInput] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);

  // Fetch workout suggestion
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['/api/workout-suggestion', props.exerciseId],
    queryFn: async () => {
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', props.exerciseId.toString());
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch workout suggestion");
      }
      return response.json();
    },
    enabled: Boolean(props.exerciseId) && Boolean(base.user),
  });

  const getCurrentSetTarget = () => {
    if (!selectedSuggestion) return null;

    const exerciseName = base.getExerciseName();
    const exercisePosition = Math.min(props.workoutDayId, props.totalExercises || 3);
    const position = `${exercisePosition} of ${props.totalExercises}`;

    const dropPercentage = props.parameters.dropPercentages[base.currentSet] || 0;
    const baseWeight = selectedSuggestion.weight;
    const weight = baseWeight * (1 - dropPercentage / 100);
    
    return {
      weight: Math.round(weight * 2) / 2,
      reps: props.parameters.maxReps,
      minReps: props.parameters.minReps,
      maxReps: props.parameters.maxReps,
      name: exerciseName,
      position
    };
  };

  const handleRepSelection = (reps: number, exceededMax: boolean = false) => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    base.setLoggedSets(prev => [...prev, {
      weight: target.weight,
      reps,
      timestamp: new Date().toISOString(),
      isFailure: false,
      exceededMax
    }]);

    if (base.currentSet + 1 >= props.parameters.sets) {
      base.setCurrentSet(prev => prev + 1);
      setShowRepsInput(false);
      props.onComplete();
    } else {
      base.setCurrentSet(prev => prev + 1);
      base.setRestTimer(props.parameters.restBetweenSets);
      setShowRepsInput(false);
    }
  };

  // Initialize workout
  useEffect(() => {
    if (!base.isWorkoutActive && suggestions) {
      const defaultSuggestion = {
        sets: props.parameters.sets,
        reps: props.parameters.maxReps,
        weight: suggestions[0]?.weight || 20,
        calculated1RM: suggestions[0]?.calculated1RM,
        name: base.getExerciseName(),
      };
      setSelectedSuggestion(defaultSuggestion);
      base.setIsWorkoutActive(true);
    }
  }, [base.isWorkoutActive, suggestions]);

  // Show rep selection dialog automatically
  useEffect(() => {
    // Show dialog when workout starts
    if (base.isWorkoutActive && base.currentSet === 0 && !showRepsInput) {
      setShowRepsInput(true);
    }
    // Show dialog after rest timer ends
    if (base.restTimer === 0 && !base.currentSet >= props.parameters.sets && !showRepsInput) {
      setShowRepsInput(true);
    }
  }, [base.isWorkoutActive, base.currentSet, base.restTimer, showRepsInput]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <base.RestTimer />

      <Dialog open={showRepsInput} onOpenChange={setShowRepsInput}>
        <DialogContent>
          <DialogTitle className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Exercise {getCurrentSetTarget()?.position}</div>
            <div className="text-xl">{getCurrentSetTarget()?.name}</div>
            <div className="text-base font-normal">
              Set {base.currentSet + 1} • {getCurrentSetTarget()?.weight}kg
            </div>
            <div className="text-sm text-muted-foreground">
              Target: {getCurrentSetTarget()?.minReps}-{getCurrentSetTarget()?.maxReps} reps
            </div>
          </DialogTitle>
          <DialogDescription>
            Select the number of repetitions completed for this set.
          </DialogDescription>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({
                length: getCurrentSetTarget()?.maxReps! - getCurrentSetTarget()?.minReps! + 1
              }, (_, i) => getCurrentSetTarget()?.minReps! + i).map((rep) => (
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
                  handleRepSelection(getCurrentSetTarget()?.maxReps! + 1, true);
                  setShowRepsInput(false);
                }}
                className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
              >
                Max Range Exceeded ({getCurrentSetTarget()?.maxReps! + 1}+ reps)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```
