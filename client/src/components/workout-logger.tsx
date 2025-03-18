import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RPTTopSetLogger } from "./rpt-top-set-logger";
import { STSLogger } from "./sts-logger";
import { DoubleProgressionLogger } from "./double-progression-logger";
import { RPTIndividualLogger } from "./rpt-individual-logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Edit2, Timer } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { STSParameters, DoubleProgressionParameters, RPTTopSetParameters, RPTIndividualParameters } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";


interface WorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  onComplete: () => void;
  totalExercises?: number;
}

export default function WorkoutLogger({ exerciseId, workoutDayId, parameters, onComplete, totalExercises = 3 }: WorkoutLoggerProps) {
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const [loggedSets, setLoggedSets] = useState<Array<{ reps: number; weight: number; timestamp: string; isFailure?: boolean; exceededMax?: boolean }>>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editReps, setEditReps] = useState<number | null>(null);
  const [extraSetReps, setExtraSetReps] = useState<number | undefined>(undefined);

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
    } catch (error) {
      console.error("Error starting workout:", error);
    }
  };

  const handleLogSet = (set: { reps: number; weight: number; timestamp: string; isFailure?: boolean; exceededMax?: boolean }) => {
    setLoggedSets(prev => [...prev, set]);
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


  const getExerciseName = () => {
    const exercise = exercises.find((e: any) => e.id === exerciseId);
    return exercise?.name || "Exercise";
  };

  const handleSetFailed = (setIndex: number) => {
    const updatedSets = [...loggedSets];
    updatedSets[setIndex] = {...updatedSets[setIndex], isFailure: true};
    setLoggedSets(updatedSets);
  };

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

  if (!isWorkoutActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workout Setup</CardTitle>
          <CardDescription>
            {isLoading ? "Loading suggestions..." : "Choose your workout target"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading suggestions...</span>
            </div>
          ) : Array.isArray(suggestions) ? (
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full text-left h-auto normal-case"
                  onClick={() => handleStartWorkout(suggestion)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      Option {idx + 1}: {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight}kg
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Estimated 1RM: {suggestion.calculated1RM.toFixed(2)}kg
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          ) : suggestions ? (
            <Button
              variant="outline"
              className="w-full text-left h-auto normal-case"
              onClick={() => handleStartWorkout(suggestions)}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">
                  {suggestions.sets} sets × {suggestions.reps} reps @ {suggestions.weight}kg
                </span>
                {suggestions.calculated1RM && (
                  <span className="text-sm text-muted-foreground">
                    Estimated 1RM: {suggestions.calculated1RM.toFixed(2)}kg
                  </span>
                )}
              </div>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Render appropriate logger component based on progression scheme
  switch (parameters.scheme) {
    case "RPT Top-Set":
      return (
        <RPTTopSetLogger
          exerciseId={exerciseId}
          workoutDayId={workoutDayId}
          parameters={parameters}
          suggestions={Array.isArray(suggestions) ? suggestions : [suggestions]}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={exercises.find((e: any) => e.id === exerciseId)?.name || "Exercise"}
          totalExercises={totalExercises}
        />
      );
    case "STS":
      return (
        <STSLogger
          exerciseId={exerciseId}
          workoutDayId={workoutDayId}
          parameters={parameters}
          suggestion={selectedSuggestion}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={exercises.find((e: any) => e.id === exerciseId)?.name || "Exercise"}
          workoutLogId={workoutLogId!}
        />
      );
    case "Double Progression":
      return (
        <DoubleProgressionLogger
          exerciseId={exerciseId}
          workoutDayId={workoutDayId}
          parameters={parameters}
          suggestion={selectedSuggestion}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={exercises.find((e: any) => e.id === exerciseId)?.name || "Exercise"}
        />
      );
    case "RPT Individual":
      return (
        <RPTIndividualLogger
          exerciseId={exerciseId}
          workoutDayId={workoutDayId}
          parameters={parameters}
          suggestions={Array.isArray(suggestions) ? suggestions : [suggestions]}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={exercises.find((e: any) => e.id === exerciseId)?.name || "Exercise"}
          totalExercises={totalExercises}
        />
      );
    default:
      return (
        <Alert>
          <AlertDescription>
            This progression scheme is not yet implemented: {parameters.scheme}
          </AlertDescription>
        </Alert>
      );
  }
}