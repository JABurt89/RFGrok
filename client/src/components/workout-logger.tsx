import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RPTTopSetLogger } from "./rpt-top-set-logger";
import { STSLogger } from "./sts-logger";
import { DoubleProgressionLogger } from "./double-progression-logger";
import { RPTIndividualLogger } from "./rpt-individual-logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { STSParameters, DoubleProgressionParameters, RPTTopSetParameters, RPTIndividualParameters } from "@shared/schema";
import { Input } from "@/components/ui/input";

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
  const [adjustedWeight, setAdjustedWeight] = useState<number | null>(null);

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

  const getExerciseName = () => {
    const exercise = exercises.find((e: any) => e.id === exerciseId);
    return exercise?.name || "Exercise";
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading workout...</span>
      </div>
    );
  }

  if (!isWorkoutActive) {
    if (parameters.scheme === "RPT Top-Set") {
      const suggestion = Array.isArray(suggestions) ? suggestions[0] : suggestions;
      return (
        <Card>
          <CardHeader>
            <CardTitle>Preview Exercise</CardTitle>
            <CardDescription>
              Review and adjust your top set weight if needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Exercise</div>
              <div className="text-lg">{getExerciseName()}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Top Set Weight</div>
              <Input
                type="number"
                step={2.5}
                value={adjustedWeight ?? suggestion?.weight ?? 0}
                onChange={(e) => setAdjustedWeight(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Set Structure</div>
              <div className="text-muted-foreground">
                {parameters.sets} sets × {parameters.minReps}-{parameters.maxReps} reps
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => {
                const adjustedSuggestion = {
                  ...suggestion,
                  weight: adjustedWeight ?? suggestion.weight
                };
                handleStartWorkout(adjustedSuggestion);
              }}
            >
              Start Exercise
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Workout Setup</CardTitle>
          <CardDescription>
            {isLoading ? "Loading suggestions..." : "Choose your workout target"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Array.isArray(suggestions) ? (
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
          suggestions={selectedSuggestion}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={getExerciseName()}
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
          exerciseName={getExerciseName()}
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
          exerciseName={getExerciseName()}
        />
      );
    case "RPT Individual":
      return (
        <RPTIndividualLogger
          exerciseId={exerciseId}
          workoutDayId={workoutDayId}
          workoutLogId={workoutLogId!}
          parameters={parameters}
          suggestions={Array.isArray(suggestions) ? suggestions : [suggestions]}
          onComplete={onComplete}
          onLogSet={handleLogSet}
          exerciseName={getExerciseName()}
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