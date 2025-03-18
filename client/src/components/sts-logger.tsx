import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, CheckCircle2, XCircle, Edit2 } from "lucide-react";
import { STSParameters } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface STSLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: STSParameters;
  suggestion: any;
  onComplete: () => void;
  onLogSet: (set: { reps: number; weight: number; timestamp: string }) => void;
  exerciseName: string;
  workoutLogId: number;
}

export function STSLogger({
  exerciseId,
  workoutDayId,
  parameters,
  suggestion,
  onComplete,
  onLogSet,
  exerciseName,
  workoutLogId
}: STSLoggerProps) {
  const { toast } = useToast();
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);
  const [extraSetReps, setExtraSetReps] = useState<number | undefined>(undefined);

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

  const handleSetComplete = () => {
    const weight = editWeight ?? suggestion.weight;
    const reps = editReps ?? suggestion.reps;

    const newSet = {
      weight,
      reps,
      timestamp: new Date().toISOString()
    };

    setLoggedSets(prev => [...prev, newSet]);
    onLogSet(newSet);

    if (currentSet + 1 >= suggestion.sets) {
      setCurrentSet(prev => prev + 1);
    } else {
      setCurrentSet(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
    }

    setIsEditing(false);
    setEditWeight(null);
    setEditReps(null);
  };

  const isLastSet = currentSet >= suggestion.sets;

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

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set {currentSet + 1} of {suggestion.sets}</CardTitle>
          <CardDescription className="text-lg font-semibold mt-2">
            <span className="text-primary">
              Target: {suggestion.weight}kg × {suggestion.reps} reps
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loggedSets.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-medium">Previous Sets:</h3>
              <div className="grid gap-2">
                {loggedSets.map((set, idx) => (
                  <div key={idx} className="text-sm flex justify-between items-center p-2 bg-muted rounded-md">
                    <span>
                      Set {idx + 1}: {set.reps} reps @ {set.weight}kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          {!isLastSet && !isEditing && (
            <>
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleSetComplete}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Set Complete
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Set
              </Button>
            </>
          )}

          {isEditing && (
            <>
              <Button onClick={handleSetComplete} className="flex-1">Save Changes</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
            </>
          )}

          {isLastSet && extraSetReps !== undefined && (
            <Button
              className="w-full"
              onClick={() => onComplete()}
            >
              Next Exercise
            </Button>
          )}
        </CardFooter>
      </Card>

      {isLastSet && extraSetReps === undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Extra Set to Failure</CardTitle>
            <CardDescription>Optional: Perform one more set to failure</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              placeholder="Number of reps"
              value={extraSetReps ?? ''}
              onChange={(e) => setExtraSetReps(Number(e.target.value))}
              className="w-full"
            />
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
                    sets: [{
                      exerciseId,
                      sets: loggedSets,
                      parameters,
                      extraSetReps: 0
                    }],
                    isComplete: true
                  });

                  if (!updateResponse.ok) {
                    const error = await updateResponse.json();
                    throw new Error(error.message || "Failed to update workout log");
                  }

                  setExtraSetReps(0);
                  onComplete();
                } catch (error) {
                  console.error("Error in skipping extra set:", error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to skip extra set",
                    variant: "destructive"
                  });
                }
              }}
            >
              Skip Extra Set
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (typeof extraSetReps === 'number') {
                    const updateResponse = await apiRequest("PATCH", `/api/workout-logs/${workoutLogId}`, {
                      sets: [{
                        exerciseId,
                        sets: loggedSets,
                        parameters,
                        extraSetReps: extraSetReps
                      }],
                      isComplete: true
                    });

                    if (!updateResponse.ok) {
                      const error = await updateResponse.json();
                      throw new Error(error.message || "Failed to update workout log");
                    }

                    onComplete();
                  } else {
                    toast({
                      title: "Error",
                      description: "Please enter the number of reps completed",
                      variant: "destructive"
                    });
                  }
                } catch (error) {
                  console.error("Error logging extra set:", error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to log extra set",
                    variant: "destructive"
                  });
                }
              }}
            >
              Log Extra Set
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
