import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Timer, Loader2 } from "lucide-react";
import { RPTTopSetParameters } from "@shared/schema";

interface RPTTopSetLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: RPTTopSetParameters;
  suggestions: any[];
  onComplete: () => void;
  onLogSet: (set: { reps: number; weight: number; timestamp: string }) => void;
  exerciseName: string;
  totalExercises: number;
}

export function RPTTopSetLogger({
  exerciseId,
  workoutDayId,
  parameters,
  suggestions,
  onComplete,
  onLogSet,
  exerciseName,
  totalExercises
}: RPTTopSetLoggerProps) {
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [showRepsInput, setShowRepsInput] = useState(true);
  const [restTimer, setRestTimer] = useState<number | null>(null);

  const currentSet = suggestions[currentSetIndex];
  const isLastSet = currentSetIndex >= parameters.sets - 1;

  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev === null || prev <= 0) return null;
          return prev - 1;
        });
      }, 1000);

      if (restTimer === 1) {
        new Audio('/chime.mp3').play().catch(console.error);
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  // Show rep selection dialog after rest timer
  useEffect(() => {
    if (restTimer === 0) {
      setRestTimer(null);
      setShowRepsInput(true);
    }
  }, [restTimer]);

  const handleRepSelection = (reps: number, exceededMax: boolean = false) => {
    const weight = currentSet.weight;
    
    onLogSet({
      reps,
      weight,
      timestamp: new Date().toISOString()
    });

    if (isLastSet) {
      onComplete();
    } else {
      setCurrentSetIndex(prev => prev + 1);
      setShowRepsInput(false);
      setRestTimer(parameters.restBetweenSets);
    }
  };

  if (!suggestions?.length) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading workout...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {restTimer !== null && restTimer > 0 && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              <span>Rest Time: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showRepsInput} onOpenChange={setShowRepsInput}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            {exerciseName}
            {currentSetIndex > 0 && (
              <span className="text-muted-foreground text-sm ml-2">
                (Drop Set: {parameters.dropPercentages[currentSetIndex]}% less)
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Target Weight: {currentSet.weight}kg
            <br />
            Select the number of repetitions completed for this set.
          </DialogDescription>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {Array.from(
                { length: parameters.maxReps - parameters.minReps + 1 },
                (_, i) => parameters.minReps + i
              ).map((rep) => (
                <Button
                  key={rep}
                  variant={rep === parameters.maxReps ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleRepSelection(rep);
                    setShowRepsInput(false);
                  }}
                  className={rep === parameters.maxReps ? "bg-primary text-primary-foreground" : ""}
                >
                  {rep}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleRepSelection(parameters.maxReps + 1, true);
                  setShowRepsInput(false);
                }}
                className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
              >
                Max Range Exceeded ({parameters.maxReps + 1}+ reps)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
