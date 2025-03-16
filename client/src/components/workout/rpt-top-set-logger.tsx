import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RPTTopSetParameters } from "@shared/schema";
import { BaseWorkoutLogger, BaseWorkoutLoggerProps } from "./base-workout-logger";

interface RPTTopSetLoggerProps extends BaseWorkoutLoggerProps {
  parameters: RPTTopSetParameters;
}

export function RPTTopSetLogger(props: RPTTopSetLoggerProps) {
  const base = BaseWorkoutLogger(props);
  const { state, dispatch } = base;

  const getCurrentSetTarget = () => {
    if (!state.selectedSuggestion) return null;

    const exerciseName = base.getExerciseName();
    const exercisePosition = Math.min(props.workoutDayId, props.totalExercises || 3);
    const position = `${exercisePosition} of ${props.totalExercises}`;

    const dropPercentage = props.parameters.dropPercentages[state.currentSet] || 0;
    const baseWeight = state.selectedSuggestion.weight;
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
    if (!state.selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    dispatch({ 
      type: 'LOG_REPS',
      payload: { 
        reps,
        exceededMax
      }
    });

    if (state.currentSet + 1 >= props.parameters.sets) {
      props.onComplete();
    } else {
      dispatch({ 
        type: 'UPDATE_REST_TIMER',
        payload: props.parameters.restBetweenSets
      });
    }
  };

  // Show rep selection dialog automatically
  useEffect(() => {
    if (state.selectedSuggestion && !state.showRepsInput) {
      dispatch({ type: 'TOGGLE_REPS_INPUT', payload: true });
    }
  }, [state.selectedSuggestion, state.currentSet]);

  // If not started, show suggestion selection
  if (!state.selectedSuggestion) {
    return <base.SuggestionSelection />;
  }

  return (
    <div className="space-y-4">
      <base.RestTimer />

      <Dialog 
        open={state.showRepsInput} 
        onOpenChange={(open) => dispatch({ type: 'TOGGLE_REPS_INPUT', payload: open })}
      >
        <DialogContent>
          <DialogTitle className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">Exercise {getCurrentSetTarget()?.position}</div>
            <div className="text-xl">{getCurrentSetTarget()?.name}</div>
            <div className="text-base font-normal">
              Set {state.currentSet + 1} • {getCurrentSetTarget()?.weight}kg
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
                  onClick={() => handleRepSelection(rep)}
                  className={rep === getCurrentSetTarget()?.maxReps ? "bg-primary text-primary-foreground" : ""}
                >
                  {rep}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRepSelection(getCurrentSetTarget()?.maxReps! + 1, true)}
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