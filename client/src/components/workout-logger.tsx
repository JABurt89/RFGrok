import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Edit2, Timer } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { STSParameters, DoubleProgressionParameters, RPTTopSetParameters, RPTIndividualParameters } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { STSProgression } from "@shared/progression";

interface WorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  onComplete: () => void;
  totalExercises?: number;
}

export default function WorkoutLogger({ exerciseId, workoutDayId, parameters, onComplete, totalExercises = 3 }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string; isFailure?: boolean; exceededMax?: boolean }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [showRepsInput, setShowRepsInput] = useState(false);

  const { data: suggestions, isLoading, error: queryError } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || "Failed to fetch workout suggestion");
      }
      return response.json();
    },
    enabled: Boolean(exerciseId) && Boolean(user),
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
  });

  const handleStartWorkout = async (suggestion: any) => {
    try {
      setSelectedSuggestion(suggestion);
      const response = await apiRequest("POST", "/api/workout-logs", {
        userId: user!.id,
        date: new Date().toISOString(),
        sets: [{
          exerciseId,
          sets: [],
          parameters,
        }],
        isComplete: false
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create workout log");
      }

      const data = await response.json();
      setWorkoutLogId(data.id);
      setIsWorkoutActive(true);
      if (parameters.scheme === "RPT Top-Set") {
        setShowRepsInput(true);
      }
    } catch (error) {
      console.error("Error starting workout:", error);
    }
  };

  const handleRepSelection = (reps: number, exceededMax: boolean = false) => {
    if (!selectedSuggestion) return;

    const target = getCurrentSetTarget();
    if (!target) return;

    const weight = target.weight;

    setLoggedSets(prev => [...prev, {
      weight,
      reps,
      timestamp: new Date().toISOString(),
      isFailure: false,
      exceededMax
    }]);

    if (currentSet + 1 >= parameters.sets) {
      setCurrentSet(prev => prev + 1);
      setCurrentSetIndex(0);
      setShowRepsInput(false);
      onComplete();
    } else {
      setCurrentSet(prev => prev + 1);
      setCurrentSetIndex(prev => prev + 1);
      setRestTimer(parameters.restBetweenSets);
      setShowRepsInput(false);
    }
  };

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

  useEffect(() => {
    if (restTimer === 0 && parameters.scheme === "RPT Top-Set") {
      setRestTimer(null);
      setShowRepsInput(true);
    }
  }, [restTimer, parameters.scheme]);

  const getExerciseName = () => {
    const exercise = exercises.find((e: any) => e.id === exerciseId);
    return exercise?.name || "Exercise";
  };

  const getCurrentSetTarget = () => {
    if (!selectedSuggestion) return null;

    const exerciseName = getExerciseName();
    const exercisePosition = Math.min(workoutDayId, totalExercises);
    const position = `${exercisePosition} of ${totalExercises}`;

    if (parameters.scheme === "RPT Top-Set") {
      const dropPercentage = parameters.dropPercentages[currentSetIndex] || 0;
      const baseWeight = selectedSuggestion.weight;
      const weight = baseWeight * (1 - dropPercentage / 100);

      return {
        weight: Math.round(weight * 2) / 2,
        reps: parameters.maxReps,
        minReps: parameters.minReps,
        maxReps: parameters.maxReps,
        name: exerciseName,
        position,
        isDropSet: currentSetIndex > 0,
        setNumber: currentSetIndex + 1
      };
    }

    return {
      weight: selectedSuggestion.weight,
      reps: selectedSuggestion.reps,
      name: exerciseName,
      position
    };
  };

  const isLastSet = currentSet >= (parameters.sets || selectedSuggestion?.sets);

  useEffect(() => {
    if (!isWorkoutActive && parameters.scheme === "RPT Top-Set") {
      const defaultSuggestion = {
        sets: parameters.sets,
        reps: parameters.maxReps,
        weight: suggestions?.[0]?.weight || 20,
        calculated1RM: suggestions?.[0]?.calculated1RM
      };
      handleStartWorkout(defaultSuggestion);
    }
  }, [isWorkoutActive, parameters.scheme, suggestions]);

  if (!user) {
    return (
      <Alert>
        <AlertDescription>Please log in to view workout suggestions.</AlertDescription>
      </Alert>
    );
  }

  if (queryError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {queryError instanceof Error ? queryError.message : 'Error loading workout suggestion'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!isWorkoutActive && parameters.scheme === "RPT Top-Set") {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Starting workout...</span>
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

      {parameters.scheme === "RPT Top-Set" && (
        <Dialog open={showRepsInput} onOpenChange={setShowRepsInput}>
          <DialogContent>
            <DialogTitle className="text-xl font-semibold">
              {getCurrentSetTarget()?.name} - Set {getCurrentSetTarget()?.setNumber}
              {getCurrentSetTarget()?.isDropSet && (
                <span className="text-muted-foreground text-sm ml-2">
                  (Drop Set: {parameters.dropPercentages[currentSetIndex]}% less)
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Target Weight: {getCurrentSetTarget()?.weight}kg
              <br />
              Select the number of repetitions completed for this set.
            </DialogDescription>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {Array.from(
                  { length: (getCurrentSetTarget()?.maxReps || 0) - (getCurrentSetTarget()?.minReps || 0) + 1 },
                  (_, i) => (getCurrentSetTarget()?.minReps || 0) + i
                ).map((rep) => (
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
                  onClick={() => {
                    const target = getCurrentSetTarget();
                    if (target) {
                      handleRepSelection(target.maxReps + 1, true);
                    }
                  }}
                  className="w-full col-span-4 bg-primary/10 hover:bg-primary/20 border-primary"
                >
                  Max Range Exceeded ({getCurrentSetTarget()?.maxReps! + 1}+ reps)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {parameters.scheme === "RPT Top-Set" && loggedSets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Sets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loggedSets.map((set, idx) => (
                <div key={idx} className="text-sm flex justify-between items-center p-2 bg-muted rounded-md">
                  <span>
                    Set {idx + 1}: {set.reps} reps @ {set.weight}kg
                    {set.exceededMax && <span className="text-primary ml-2">(Exceeded Max)</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}