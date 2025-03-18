import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Timer, Loader2 } from "lucide-react";
import { RPTIndividualParameters } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RPTIndividualLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: RPTIndividualParameters;
  suggestions: any[];
  onComplete: () => void;
  onLogSet: (set: { reps: number; weight: number; timestamp: string }) => void;
  exerciseName: string;
  totalExercises: number;
}

export function RPTIndividualLogger({
  exerciseId,
  workoutDayId,
  parameters,
  suggestions,
  onComplete,
  onLogSet,
  exerciseName,
  totalExercises
}: RPTIndividualLoggerProps) {
  const { toast } = useToast();
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string }>>([]);

  // Get base weight from suggestions
  const baseWeight = suggestions[0]?.weight || 20;

  // Current set configuration
  const currentSetConfig = parameters.setConfigs[currentSetIndex];
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

  const handleRepSelection = async (reps: number, exceededMax: boolean = false) => {
    const newSet = {
      reps,
      weight: baseWeight,
      timestamp: new Date().toISOString()
    };

    setLoggedSets(prev => [...prev, newSet]);
    onLogSet(newSet);

    if (isLastSet) {
      try {
        // Update the workout log with all completed sets
        const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutDayId}`, {
          sets: [{
            exerciseId,
            sets: [...loggedSets, newSet],
            parameters,
          }],
          isComplete: true
        });

        if (!updateResponse.ok) {
          throw new Error("Failed to update workout log");
        }

        onComplete();
      } catch (error) {
        console.error("Error updating workout log:", error);
        toast({
          title: "Error",
          description: "Failed to save workout log",
          variant: "destructive"
        });
      }
    } else {
      setCurrentSetIndex(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
    }
  };

  if (!suggestions?.length || !currentSetConfig) {
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
          <span className="text-muted-foreground text-sm ml-2">
            Set {currentSetIndex + 1} of {parameters.sets}
          </span>
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
          Target Weight: {baseWeight}kg ({currentSetConfig.min}-{currentSetConfig.max} reps)
          <br />
          {loggedSets.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              Previous sets: {loggedSets.map((set, idx) => `${set.reps} reps`).join(', ')}
            </div>
          )}
          <br />
          Select the number of repetitions completed for this set.
        </DialogDescription>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {Array.from(
              { length: currentSetConfig.max - currentSetConfig.min + 1 },
              (_, i) => currentSetConfig.min + i
            ).map((rep) => (
              <Button
                key={rep}
                variant={rep === currentSetConfig.max ? "default" : "outline"}
                size="sm"
                onClick={() => handleRepSelection(rep)}
                className={rep === currentSetConfig.max ? "bg-primary text-primary-foreground" : ""}
              >
                {rep}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRepSelection(currentSetConfig.max + 1, true)}
              className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
            >
              Max Range Exceeded ({currentSetConfig.max + 1}+ reps)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}