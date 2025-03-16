import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export interface BaseWorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  onComplete: () => void;
  totalExercises?: number;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  timestamp: string;
  isFailure?: boolean;
  exceededMax?: boolean;
}

export interface WorkoutSuggestion {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM?: number;
  name?: string;
}

export function BaseWorkoutLogger({ exerciseId, workoutDayId, onComplete, totalExercises = 3 }: BaseWorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<WorkoutSuggestion | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);

  // Fetch exercises for reference
  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
  });

  // Fetch workout suggestion
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId],
    queryFn: async () => {
      const url = new URL('/api/workout-suggestion', window.location.origin);
      url.searchParams.append('exerciseId', exerciseId.toString());
      const response = await apiRequest("GET", url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch workout suggestion");
      }
      return response.json();
    },
    enabled: Boolean(exerciseId) && Boolean(user),
  });

  // Get exercise name
  const getExerciseName = () => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Exercise";
  };

  // Rest timer effect
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev === null || prev <= 0) return null;
          return prev - 1;
        });
      }, 1000);

      // Play sound when timer reaches 0
      if (restTimer === 1) {
        new Audio('/chime.mp3').play().catch(console.error);
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  if (!user) {
    return (
      <Alert>
        <AlertDescription>Please log in to view workout suggestions.</AlertDescription>
      </Alert>
    );
  }

  // Loading state
  if (suggestionsLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading workout suggestions...</span>
      </div>
    );
  }

  // Rest Timer Component
  const RestTimer = () => {
    if (restTimer === null || restTimer <= 0) return null;

    return (
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <span>Rest Time: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}</span>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  // Suggestion selection UI
  const SuggestionSelection = () => {
    if (!suggestions) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Start Workout</CardTitle>
          <CardDescription>
            {getExerciseName()} - Exercise {workoutDayId} of {totalExercises}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(suggestions) ? (
              suggestions.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full text-left h-auto normal-case"
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      Option {idx + 1}: {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight}kg
                    </span>
                    {suggestion.calculated1RM && (
                      <span className="text-sm text-muted-foreground">
                        Estimated 1RM: {suggestion.calculated1RM.toFixed(2)}kg
                      </span>
                    )}
                  </div>
                </Button>
              ))
            ) : (
              <Button
                variant="outline"
                className="w-full text-left h-auto normal-case"
                onClick={() => setSelectedSuggestion(suggestions)}
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
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return {
    isWorkoutActive,
    setIsWorkoutActive,
    currentSet,
    setCurrentSet,
    loggedSets,
    setLoggedSets,
    restTimer,
    setRestTimer,
    workoutLogId,
    setWorkoutLogId,
    selectedSuggestion,
    setSelectedSuggestion,
    getExerciseName,
    RestTimer,
    SuggestionSelection,
    queryClient,
    toast,
    user,
    exercises,
    suggestions,
    suggestionsLoading
  };
}