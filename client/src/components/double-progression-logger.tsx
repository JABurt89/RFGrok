import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, CheckCircle2, XCircle, Edit2 } from "lucide-react";
import { DoubleProgressionParameters } from "@shared/schema";

interface DoubleProgressionLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: DoubleProgressionParameters;
  suggestion: any;
  onComplete: () => void;
  onLogSet: (set: { reps: number; weight: number; timestamp: string }) => void;
  exerciseName: string;
}

export function DoubleProgressionLogger({
  exerciseId,
  workoutDayId,
  parameters,
  suggestion,
  onComplete,
  onLogSet,
  exerciseName
}: DoubleProgressionLoggerProps) {
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);

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

    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString()
    }]);
    onLogSet({
      weight,
      reps,
      timestamp: new Date().toISOString()
    });

    if (currentSet + 1 >= parameters.targetSets) {
      setCurrentSet(prev => prev + 1);
      onComplete();
    } else {
      setCurrentSet(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
    }

    setIsEditing(false);
    setEditWeight(null);
    setEditReps(null);
  };

  const isLastSet = currentSet >= parameters.targetSets;

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
          <CardTitle className="text-2xl">Set {currentSet + 1} of {parameters.targetSets}</CardTitle>
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

          {isLastSet && !isEditing && (
            <Button
              className="w-full"
              onClick={() => onComplete()}
            >
              Next Exercise
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
