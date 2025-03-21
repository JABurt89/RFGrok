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
  suggestions: any;
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
  const [restTimer, setRestTimer] = useState<number | null>(null);

  // Calculate weights for all sets based on top set weight and drop percentages
  const setWeights = parameters.dropPercentages.map((dropPercentage, index) => {
    const topSetWeight = suggestions.weight;
    const weight = topSetWeight * (1 - (dropPercentage || 0) / 100);
    return Math.round(weight * 2) / 2; // Round to nearest 0.5
  });

  const currentWeight = setWeights[currentSetIndex];
  const isLastSet = currentSetIndex >= parameters.sets - 1;
  const isDropSet = currentSetIndex > 0;

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

  const handleRepSelection = (reps: number, exceededMax: boolean = false) => {
    onLogSet({
      reps,
      weight: currentWeight,
      timestamp: new Date().toISOString()
    });

    if (isLastSet) {
      onComplete();
    } else {
      setCurrentSetIndex(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
    }
  };

  if (!suggestions) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading workout...</span>
      </div>
    );
  }

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {exerciseName}
          {isDropSet && (
            <span className="text-muted-foreground text-sm ml-2">
              (Drop Set: {parameters.dropPercentages[currentSetIndex]}% less)
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          {restTimer !== null && restTimer > 0 && (
            <div className="mb-4 p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-5 w-5" />
                <span>Rest Time: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>
          )}
          Target Weight: {currentWeight}kg
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
                onClick={() => handleRepSelection(rep)}
                className={rep === parameters.maxReps ? "bg-primary text-primary-foreground" : ""}
              >
                {rep}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRepSelection(parameters.maxReps + 1, true)}
              className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
            >
              Max Range Exceeded ({parameters.maxReps + 1}+ reps)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}